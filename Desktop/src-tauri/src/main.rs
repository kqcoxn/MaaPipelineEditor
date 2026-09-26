#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
mod content;
mod crash;
mod credentials;
mod desktop_release;
mod engine;
mod exports;
mod log_text;
mod logs;
mod releases;
mod resources;
mod session;
mod settings;
mod startup;
mod state;
#[cfg(windows)]
mod windows_job;

use fs2::FileExt;
use std::{fs::OpenOptions, path::PathBuf, sync::atomic::Ordering};
use tauri::Manager;
fn main() {
    let base = if cfg!(windows) {
        PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap_or_default())
    } else {
        PathBuf::from(std::env::var_os("HOME").unwrap_or_default())
            .join("Library/Application Support")
    };
    let dir = base.join("MPE-Desktop");
    std::fs::create_dir_all(&dir).expect("创建 MPE Desktop 数据目录");
    let instance = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("instance.lock"))
        .expect("打开实例锁");
    if instance.try_lock_exclusive().is_err() {
        rfd::MessageDialog::new()
            .set_title("MPE Desktop")
            .set_description("已有实例正在运行，本次启动已取消。")
            .show();
        return;
    }
    let app = crash::configure(tauri::Builder::default())
        .manage(state::InstanceLock(instance))
        .manage(startup::Startup::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_uri_scheme_protocol("mpe", |context, request| {
            resources::read(context.app_handle(), request)
        })
        .setup(|app| {
            std::fs::create_dir_all(settings::data_dir(app.handle()))?;
            logs::record(
                app.handle(),
                concat!(
                    "启动 MPE Desktop v",
                    env!("CARGO_PKG_VERSION"),
                    " · 桌面修订号 ",
                    env!("MPE_DESKTOP_REVISION")
                ),
            );
            app.manage(state::State::new(settings::load(app.handle())));
            session::monitor(app.handle().clone());
            startup::watch(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::launcher_ready,
            commands::save_settings,
            commands::add_project,
            commands::remove_project,
            commands::relocate_project,
            commands::check_environment,
            commands::install_environment,
            commands::start_editor,
            commands::stop_conflict,
            commands::open_config,
            commands::open_link,
            commands::choose_background,
            commands::homepage,
            commands::release_versions,
            commands::release_notes,
            commands::github_token_status,
            commands::save_github_token,
            commands::update_desktop,
            commands::quit_desktop,
            commands::desktop_reply,
            commands::desktop_open_devtools,
            commands::desktop_heartbeat,
            commands::desktop_save_path,
            exports::desktop_save_archive,
            logs::list_logs,
            logs::read_log,
            logs::export_logs,
            logs::open_logs_directory
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed)
                && window.label() == "renderer"
                && window
                    .app_handle()
                    .state::<state::State>()
                    .session
                    .lock()
                    .unwrap()
                    .is_some()
            {
                session::aborted(window.app_handle().clone());
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<state::State>();
                if state.busy.load(Ordering::SeqCst) {
                    api.prevent_close();
                    return;
                }
                if window.label() == "renderer" {
                    api.prevent_close();
                    session::request_close(app, false)
                } else if state.session.lock().unwrap().is_some() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("启动 MPE Desktop");
    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let state = app.state::<state::State>();
            if state.busy.load(Ordering::SeqCst) {
                api.prevent_exit();
                return;
            }
            if state.session.lock().unwrap().is_some() {
                api.prevent_exit();
                session::request_close(app, true)
            }
        }
    });
}
