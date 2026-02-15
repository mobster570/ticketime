use crate::db::Database;
use std::collections::HashMap;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

pub struct AppState {
    pub db: Database,
    pub active_syncs: Mutex<HashMap<i64, CancellationToken>>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            active_syncs: Mutex::new(HashMap::new()),
        }
    }
}
