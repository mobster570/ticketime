use crate::error::AppError;
use crate::models::{
    AppSettings, Server, ServerStatus, SyncCompletePayload, SyncErrorPayload, SyncEvent, SyncPhase,
    SyncProgressPayload, SyncResult,
};
use crate::state::AppState;
use crate::sync_engine;
use crate::time_extractor::DateHeaderExtractor;
use std::time::Instant;
use tauri::ipc::Channel;
use tauri::{Manager, State};
use tokio_util::sync::CancellationToken;

#[tauri::command]
pub async fn add_server(url: String, state: State<'_, AppState>) -> Result<Server, AppError> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| AppError::InvalidUrl(e.to_string()))?;

    let final_url = if parsed.scheme() == "http" || parsed.scheme() == "https" {
        url
    } else {
        format!("https://{url}")
    };

    state.db.add_server(&final_url)
}

#[tauri::command]
pub async fn get_server(id: i64, state: State<'_, AppState>) -> Result<Server, AppError> {
    state.db.get_server(id)
}

#[tauri::command]
pub async fn list_servers(state: State<'_, AppState>) -> Result<Vec<Server>, AppError> {
    state.db.list_servers()
}

#[tauri::command]
pub async fn delete_server(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    {
        let mut syncs = state.active_syncs.lock().expect("active_syncs poisoned");
        if let Some(token) = syncs.remove(&id) {
            token.cancel();
        }
    }
    state.db.delete_server(id)
}

#[tauri::command]
pub async fn start_sync(
    id: i64,
    on_event: Channel<SyncEvent>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let server = state.db.get_server(id)?;
    let url = server.url.clone();

    let token = CancellationToken::new();
    {
        let mut syncs = state.active_syncs.lock().expect("active_syncs poisoned");
        syncs.insert(id, token.clone());
    }

    state.db.update_server_status(id, &ServerStatus::Syncing)?;

    let sync_start = Instant::now();
    let on_event_clone = on_event.clone();
    let extractor = DateHeaderExtractor;

    // Progress callback sends through Channel
    let on_event_progress = on_event.clone();
    let progress_callback: sync_engine::ProgressCallback = Box::new(move |data| {
        let phase: SyncPhase = serde_json::from_value(
            data.get("phase")
                .expect("progress data must contain phase")
                .clone(),
        )
        .expect("progress phase must be a valid SyncPhase");

        let progress_percent = match phase {
            SyncPhase::LatencyProfiling => {
                let idx = data
                    .get("probe_index")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                let total = data
                    .get("total_probes")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(10.0);
                (idx / total) * 25.0
            }
            SyncPhase::WholeSecondOffset => 30.0,
            SyncPhase::BinarySearch => {
                let convergence = data
                    .get("convergence_percent")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                35.0 + convergence * 0.55
            }
            SyncPhase::Verification => 92.0,
            SyncPhase::Complete => 100.0,
        };

        let elapsed_ms = sync_start.elapsed().as_millis() as u64;

        let _ = on_event_progress.send(SyncEvent::Progress(SyncProgressPayload {
            server_id: id,
            phase,
            progress_percent,
            phase_data: data,
            elapsed_ms,
        }));
    });

    let handle = app_handle.clone();

    tokio::spawn(async move {
        let result = sync_engine::synchronize(id, &url, &extractor, token, progress_callback).await;

        let app_state = handle.state::<AppState>();

        // Remove from active syncs first (always, regardless of result)
        {
            let mut syncs = app_state
                .active_syncs
                .lock()
                .expect("active_syncs poisoned");
            syncs.remove(&id);
        }

        match result {
            Ok(ref sync_result) => {
                // Persist to DB via spawn_blocking to avoid blocking the tokio runtime.
                // Gracefully ignore errors (server may have been deleted during sync).
                let sync_result_clone = sync_result.clone();
                let handle_inner = handle.clone();
                let _ = tokio::task::spawn_blocking(move || {
                    let state = handle_inner.state::<AppState>();
                    let _ = state.db.update_server_offset(
                        id,
                        sync_result_clone.total_offset_ms,
                        sync_result_clone.synced_at,
                    );
                    let _ = state.db.update_server_status(id, &ServerStatus::Synced);
                    let _ = state.db.save_sync_result(&sync_result_clone);
                })
                .await;

                let _ = on_event_clone.send(SyncEvent::Complete(SyncCompletePayload {
                    server_id: id,
                    result: sync_result.clone(),
                }));
            }
            Err(ref e) => {
                // Gracefully ignore DB errors (server may have been deleted)
                let handle_inner = handle.clone();
                let _ = tokio::task::spawn_blocking(move || {
                    let state = handle_inner.state::<AppState>();
                    let _ = state.db.update_server_status(id, &ServerStatus::Error);
                })
                .await;

                let _ = on_event_clone.send(SyncEvent::Error(SyncErrorPayload {
                    server_id: id,
                    error: e.to_string(),
                }));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_sync(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let mut syncs = state.active_syncs.lock().expect("active_syncs poisoned");
    if let Some(token) = syncs.remove(&id) {
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_sync_history(
    id: i64,
    since: Option<String>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<SyncResult>, AppError> {
    state.db.get_sync_history(id, since.as_deref(), limit)
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    state.db.get_settings()
}

#[tauri::command]
pub async fn update_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.db.update_settings(&settings)
}
