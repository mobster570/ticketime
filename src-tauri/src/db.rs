use crate::error::AppError;
use crate::models::{AppSettings, LatencyProfile, Server, ServerStatus, SyncPhase, SyncResult};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::collections::HashMap;
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
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
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
                    status: status_str.parse().unwrap_or(ServerStatus::Idle),
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
        let profile_json =
            serde_json::to_string(&result.latency_profile).unwrap_or_else(|_| "{}".to_string());
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
                i32::from(result.phase_reached),
            ],
        )?;
        Ok(())
    }

    pub fn get_settings(&self) -> Result<AppSettings, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows: HashMap<String, String> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();

        let defaults = AppSettings::default();

        Ok(AppSettings {
            theme: rows.get("theme").cloned().unwrap_or(defaults.theme),
            min_request_interval_ms: rows
                .get("min_request_interval_ms")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.min_request_interval_ms),
            health_resync_threshold: rows
                .get("health_resync_threshold")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.health_resync_threshold),
            external_time_source: rows
                .get("external_time_source")
                .cloned()
                .unwrap_or(defaults.external_time_source),
            show_milliseconds: rows
                .get("show_milliseconds")
                .map(|v| v == "true")
                .unwrap_or(defaults.show_milliseconds),
            millisecond_precision: rows
                .get("millisecond_precision")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.millisecond_precision),
            show_timezone_offset: rows
                .get("show_timezone_offset")
                .map(|v| v == "true")
                .unwrap_or(defaults.show_timezone_offset),
            overlay_opacity: rows
                .get("overlay_opacity")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.overlay_opacity),
            overlay_auto_hide: rows
                .get("overlay_auto_hide")
                .map(|v| v == "true")
                .unwrap_or(defaults.overlay_auto_hide),
            overlay_always_on_top: rows
                .get("overlay_always_on_top")
                .map(|v| v == "true")
                .unwrap_or(defaults.overlay_always_on_top),
            alert_intervals: rows
                .get("alert_intervals")
                .and_then(|v| serde_json::from_str(v).ok())
                .unwrap_or(defaults.alert_intervals),
            alert_method: rows
                .get("alert_method")
                .cloned()
                .unwrap_or(defaults.alert_method),
            drift_warning_threshold_ms: rows
                .get("drift_warning_threshold_ms")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.drift_warning_threshold_ms),
        })
    }

    pub fn update_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;

        let pairs: Vec<(&str, String)> = vec![
            ("theme", settings.theme.clone()),
            (
                "min_request_interval_ms",
                settings.min_request_interval_ms.to_string(),
            ),
            (
                "health_resync_threshold",
                settings.health_resync_threshold.to_string(),
            ),
            (
                "external_time_source",
                settings.external_time_source.clone(),
            ),
            ("show_milliseconds", settings.show_milliseconds.to_string()),
            (
                "millisecond_precision",
                settings.millisecond_precision.to_string(),
            ),
            (
                "show_timezone_offset",
                settings.show_timezone_offset.to_string(),
            ),
            ("overlay_opacity", settings.overlay_opacity.to_string()),
            ("overlay_auto_hide", settings.overlay_auto_hide.to_string()),
            (
                "overlay_always_on_top",
                settings.overlay_always_on_top.to_string(),
            ),
            (
                "alert_intervals",
                serde_json::to_string(&settings.alert_intervals)
                    .unwrap_or_else(|_| "[]".to_string()),
            ),
            ("alert_method", settings.alert_method.clone()),
            (
                "drift_warning_threshold_ms",
                settings.drift_warning_threshold_ms.to_string(),
            ),
        ];

        for (key, value) in pairs {
            tx.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_sync_history(
        &self,
        server_id: i64,
        since: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<SyncResult>, AppError> {
        let conn = self.conn.lock().unwrap();

        let mut sql = String::from(
            "SELECT server_id, whole_second_offset, subsecond_offset, total_offset_ms, latency_profile_json, verified, synced_at, duration_ms, phase_reached
             FROM sync_results WHERE server_id = ?1",
        );
        if since.is_some() {
            sql.push_str(" AND synced_at >= ?2");
        }
        sql.push_str(" ORDER BY synced_at DESC");
        if limit.is_some() {
            sql.push_str(if since.is_some() {
                " LIMIT ?3"
            } else {
                " LIMIT ?2"
            });
        }

        let mut stmt = conn.prepare(&sql)?;

        let row_mapper = |row: &rusqlite::Row| {
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
                phase_reached: SyncPhase::try_from(row.get::<_, i32>(8)?).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        8,
                        rusqlite::types::Type::Integer,
                        Box::from(e),
                    )
                })?,
            })
        };

        let results = match (since, limit) {
            (Some(s), Some(l)) => stmt
                .query_map(params![server_id, s, l], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?,
            (Some(s), None) => stmt
                .query_map(params![server_id, s], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?,
            (None, Some(l)) => stmt
                .query_map(params![server_id, l], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?,
            (None, None) => stmt
                .query_map(params![server_id], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?,
        };

        Ok(results)
    }
}

#[cfg(test)]
impl Database {
    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AppSettings, LatencyProfile, ServerStatus, SyncPhase, SyncResult};
    use chrono::{Duration, Utc};

    fn make_test_sync_result(server_id: i64, offset_ms: f64, synced_at: chrono::DateTime<Utc>) -> SyncResult {
        SyncResult {
            server_id,
            whole_second_offset: (offset_ms / 1000.0) as i64,
            subsecond_offset: (offset_ms % 1000.0) / 1000.0,
            total_offset_ms: offset_ms,
            latency_profile: LatencyProfile {
                min: 0.040,
                q1: 0.045,
                median: 0.050,
                mean: 0.050,
                q3: 0.055,
                max: 0.060,
            },
            verified: true,
            synced_at,
            duration_ms: 5000,
            phase_reached: SyncPhase::Complete,
        }
    }

    #[test]
    fn test_add_server_returns_correct_fields() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        assert!(server.id > 0);
        assert_eq!(server.url, "https://example.com");
        assert_eq!(server.status, ServerStatus::Idle);
        assert_eq!(server.extractor_type, "date_header");
        assert!(server.offset_ms.is_none());
        assert!(server.last_sync_at.is_none());
        assert!(server.name.is_none());
    }

    #[test]
    fn test_add_server_duplicate_url_returns_err() {
        let db = Database::new_in_memory().unwrap();
        db.add_server("https://example.com").unwrap();
        let result = db.add_server("https://example.com");
        assert!(result.is_err());
    }

    #[test]
    fn test_list_servers_empty_initially() {
        let db = Database::new_in_memory().unwrap();
        let servers = db.list_servers().unwrap();
        assert!(servers.is_empty());
    }

    #[test]
    fn test_list_servers_returns_added_servers_in_order() {
        let db = Database::new_in_memory().unwrap();
        db.add_server("https://alpha.example.com").unwrap();
        db.add_server("https://beta.example.com").unwrap();
        let servers = db.list_servers().unwrap();
        assert_eq!(servers.len(), 2);
        assert_eq!(servers[0].url, "https://alpha.example.com");
        assert_eq!(servers[1].url, "https://beta.example.com");
    }

    #[test]
    fn test_get_server_retrieves_by_id() {
        let db = Database::new_in_memory().unwrap();
        let added = db.add_server("https://example.com").unwrap();
        let fetched = db.get_server(added.id).unwrap();
        assert_eq!(fetched.id, added.id);
        assert_eq!(fetched.url, "https://example.com");
    }

    #[test]
    fn test_get_server_not_found_returns_err() {
        let db = Database::new_in_memory().unwrap();
        let result = db.get_server(9999);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_server_removes_it() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        db.delete_server(server.id).unwrap();
        let result = db.get_server(server.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_server_offset_updates_fields() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        let now = Utc::now();
        db.update_server_offset(server.id, 42.5, now).unwrap();
        let updated = db.get_server(server.id).unwrap();
        assert!((updated.offset_ms.unwrap() - 42.5).abs() < 0.001);
        assert!(updated.last_sync_at.is_some());
    }

    #[test]
    fn test_update_server_status_changes_status() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        db.update_server_status(server.id, &ServerStatus::Syncing).unwrap();
        let updated = db.get_server(server.id).unwrap();
        assert_eq!(updated.status, ServerStatus::Syncing);
    }

    #[test]
    fn test_save_and_retrieve_sync_result() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        let now = Utc::now();
        let result = make_test_sync_result(server.id, 150.0, now);
        db.save_sync_result(&result).unwrap();

        let history = db.get_sync_history(server.id, None, None).unwrap();
        assert_eq!(history.len(), 1);
        let r = &history[0];
        assert_eq!(r.server_id, server.id);
        assert!((r.total_offset_ms - 150.0).abs() < 0.001);
        assert_eq!(r.verified, true);
        assert_eq!(r.duration_ms, 5000);
        assert_eq!(r.phase_reached, SyncPhase::Complete);
        assert!((r.latency_profile.median - 0.050).abs() < 0.0001);
    }

    #[test]
    fn test_get_sync_history_respects_limit() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        let base = Utc::now();
        for i in 0..5i64 {
            let r = make_test_sync_result(server.id, i as f64 * 10.0, base + Duration::seconds(i));
            db.save_sync_result(&r).unwrap();
        }
        let history = db.get_sync_history(server.id, None, Some(2)).unwrap();
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn test_get_sync_history_filters_by_since() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        let base = Utc::now();
        // Insert one old result and one recent result
        let old_result = make_test_sync_result(server.id, 10.0, base - Duration::hours(2));
        let new_result = make_test_sync_result(server.id, 20.0, base);
        db.save_sync_result(&old_result).unwrap();
        db.save_sync_result(&new_result).unwrap();

        let cutoff = (base - Duration::hours(1)).to_rfc3339();
        let history = db.get_sync_history(server.id, Some(&cutoff), None).unwrap();
        assert_eq!(history.len(), 1);
        assert!((history[0].total_offset_ms - 20.0).abs() < 0.001);
    }

    #[test]
    fn test_get_sync_history_ordered_desc() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        let base = Utc::now();
        for i in 0..3i64 {
            let r = make_test_sync_result(server.id, i as f64 * 10.0, base + Duration::seconds(i));
            db.save_sync_result(&r).unwrap();
        }
        let history = db.get_sync_history(server.id, None, None).unwrap();
        // Most recent first
        assert!(history[0].synced_at >= history[1].synced_at);
        assert!(history[1].synced_at >= history[2].synced_at);
    }

    #[test]
    fn test_get_settings_returns_defaults_when_empty() {
        let db = Database::new_in_memory().unwrap();
        let settings = db.get_settings().unwrap();
        let defaults = AppSettings::default();
        assert_eq!(settings.theme, defaults.theme);
        assert_eq!(settings.min_request_interval_ms, defaults.min_request_interval_ms);
        assert_eq!(settings.show_milliseconds, defaults.show_milliseconds);
    }

    #[test]
    fn test_update_and_get_settings_roundtrip() {
        let db = Database::new_in_memory().unwrap();
        let mut settings = AppSettings::default();
        settings.theme = "light".to_string();
        settings.show_milliseconds = true;
        settings.min_request_interval_ms = 2000;
        settings.overlay_opacity = 80;
        db.update_settings(&settings).unwrap();

        let loaded = db.get_settings().unwrap();
        assert_eq!(loaded.theme, "light");
        assert_eq!(loaded.show_milliseconds, true);
        assert_eq!(loaded.min_request_interval_ms, 2000);
        assert_eq!(loaded.overlay_opacity, 80);
    }

    #[test]
    fn test_delete_server_cascades_sync_results() {
        let db = Database::new_in_memory().unwrap();
        let server = db.add_server("https://example.com").unwrap();
        let r = make_test_sync_result(server.id, 50.0, Utc::now());
        db.save_sync_result(&r).unwrap();

        // Verify result exists before delete
        let before = db.get_sync_history(server.id, None, None).unwrap();
        assert_eq!(before.len(), 1);

        db.delete_server(server.id).unwrap();

        // Server is gone; sync results should be gone too
        // We verify by checking a fresh server gets no history and the old ID returns error
        assert!(db.get_server(server.id).is_err());
        // Use a raw query to confirm cascade deleted the sync_results row
        let conn = db.conn.lock().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_results WHERE server_id = ?1",
                params![server.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }
}
