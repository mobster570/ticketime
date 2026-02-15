use crate::error::AppError;
use crate::models::{LatencyProfile, Server, ServerStatus, SyncResult};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> Result<Self, AppError> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .expect("failed to resolve app data dir");
        std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");

        let db_path = app_dir.join("ticketime.db");
        let conn = Connection::open(db_path)?;

        conn.execute_batch("PRAGMA journal_mode=WAL;")?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL UNIQUE,
                name TEXT,
                offset_ms REAL,
                last_sync_at TEXT,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'idle',
                extractor_type TEXT NOT NULL DEFAULT 'date_header'
            );

            CREATE TABLE IF NOT EXISTS sync_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                whole_second_offset INTEGER NOT NULL,
                subsecond_offset REAL NOT NULL,
                total_offset_ms REAL NOT NULL,
                latency_profile_json TEXT NOT NULL,
                verified INTEGER NOT NULL DEFAULT 0,
                synced_at TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                phase_reached INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
            );",
        )?;
        Ok(())
    }

    pub fn add_server(&self, url: &str) -> Result<Server, AppError> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now();
        conn.execute(
            "INSERT INTO servers (url, created_at, status, extractor_type) VALUES (?1, ?2, ?3, ?4)",
            params![url, now.to_rfc3339(), "idle", "date_header"],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Server {
            id,
            url: url.to_string(),
            name: None,
            offset_ms: None,
            last_sync_at: None,
            created_at: now,
            status: ServerStatus::Idle,
            extractor_type: "date_header".to_string(),
        })
    }

    pub fn list_servers(&self) -> Result<Vec<Server>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, name, offset_ms, last_sync_at, created_at, status, extractor_type FROM servers ORDER BY id",
        )?;
        let servers = stmt
            .query_map([], |row| {
                let status_str: String = row.get(6)?;
                let last_sync_str: Option<String> = row.get(4)?;
                let created_str: String = row.get(5)?;
                Ok(Server {
                    id: row.get(0)?,
                    url: row.get(1)?,
                    name: row.get(2)?,
                    offset_ms: row.get(3)?,
                    last_sync_at: last_sync_str.and_then(|s| {
                        DateTime::parse_from_rfc3339(&s)
                            .ok()
                            .map(|dt| dt.with_timezone(&Utc))
                    }),
                    created_at: DateTime::parse_from_rfc3339(&created_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    status: status_str
                        .parse()
                        .unwrap_or(ServerStatus::Idle),
                    extractor_type: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(servers)
    }

    pub fn get_server(&self, id: i64) -> Result<Server, AppError> {
        let conn = self.conn.lock().unwrap();
        let server = conn.query_row(
            "SELECT id, url, name, offset_ms, last_sync_at, created_at, status, extractor_type FROM servers WHERE id = ?1",
            params![id],
            |row| {
                let status_str: String = row.get(6)?;
                let last_sync_str: Option<String> = row.get(4)?;
                let created_str: String = row.get(5)?;
                Ok(Server {
                    id: row.get(0)?,
                    url: row.get(1)?,
                    name: row.get(2)?,
                    offset_ms: row.get(3)?,
                    last_sync_at: last_sync_str.and_then(|s| {
                        DateTime::parse_from_rfc3339(&s)
                            .ok()
                            .map(|dt| dt.with_timezone(&Utc))
                    }),
                    created_at: DateTime::parse_from_rfc3339(&created_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    status: status_str
                        .parse()
                        .unwrap_or(ServerStatus::Idle),
                    extractor_type: row.get(7)?,
                })
            },
        )?;
        Ok(server)
    }

    pub fn delete_server(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM sync_results WHERE server_id = ?1", params![id])?;
        conn.execute("DELETE FROM servers WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_server_offset(
        &self,
        id: i64,
        offset_ms: f64,
        synced_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE servers SET offset_ms = ?1, last_sync_at = ?2 WHERE id = ?3",
            params![offset_ms, synced_at.to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn update_server_status(&self, id: i64, status: &ServerStatus) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE servers SET status = ?1 WHERE id = ?2",
            params![status.to_string(), id],
        )?;
        Ok(())
    }

    pub fn save_sync_result(&self, result: &SyncResult) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let profile_json = serde_json::to_string(&result.latency_profile)
            .unwrap_or_else(|_| "{}".to_string());
        conn.execute(
            "INSERT INTO sync_results (server_id, whole_second_offset, subsecond_offset, total_offset_ms, latency_profile_json, verified, synced_at, duration_ms, phase_reached)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                result.server_id,
                result.whole_second_offset,
                result.subsecond_offset,
                result.total_offset_ms,
                profile_json,
                result.verified as i32,
                result.synced_at.to_rfc3339(),
                result.duration_ms as i64,
                result.phase_reached as i32,
            ],
        )?;
        Ok(())
    }

    pub fn get_sync_history(&self, server_id: i64) -> Result<Vec<SyncResult>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT server_id, whole_second_offset, subsecond_offset, total_offset_ms, latency_profile_json, verified, synced_at, duration_ms, phase_reached
             FROM sync_results WHERE server_id = ?1 ORDER BY synced_at DESC",
        )?;
        let results = stmt
            .query_map(params![server_id], |row| {
                let profile_json: String = row.get(4)?;
                let synced_str: String = row.get(6)?;
                Ok(SyncResult {
                    server_id: row.get(0)?,
                    whole_second_offset: row.get(1)?,
                    subsecond_offset: row.get(2)?,
                    total_offset_ms: row.get(3)?,
                    latency_profile: serde_json::from_str(&profile_json).unwrap_or(LatencyProfile {
                        min: 0.0,
                        q1: 0.0,
                        median: 0.0,
                        mean: 0.0,
                        q3: 0.0,
                        max: 0.0,
                    }),
                    verified: row.get::<_, i32>(5)? != 0,
                    synced_at: DateTime::parse_from_rfc3339(&synced_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    duration_ms: row.get::<_, i64>(7)? as u64,
                    phase_reached: row.get::<_, i32>(8)? as u8,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    }
}
