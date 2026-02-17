mod commands;
mod db;
mod error;
mod models;
mod state;
mod sync_engine;
mod time_extractor;
mod timing;

use db::Database;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let db = Database::new(app.handle())?;
            let app_state = AppState::new(db);
            app.manage(app_state);

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::add_server,
            commands::get_server,
            commands::list_servers,
            commands::delete_server,
            commands::start_sync,
            commands::cancel_sync,
            commands::get_sync_history,
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
