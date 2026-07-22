mod bridge;
mod commands;
mod environment;
mod error;
mod models;
mod process_group;
mod python;
mod settings;
mod tray;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use commands::AppState;
use models::CapabilityStatus;
use settings::SettingsStore;
use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            tray::toggle_window(app);
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--hidden")
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let state = app.state::<AppState>();
                    let preferences = state.settings.get();
                    let pressed = shortcut.into_string();
                    if pressed == preferences.show_hide_shortcut {
                        tray::toggle_window(app);
                    } else if pressed == preferences.stop_debug_shortcut {
                        let _ = app.emit("desktop-stop-debug", ());
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::localbridge_bootstrap,
            commands::localbridge_status,
            commands::restart_localbridge,
            commands::repair_localbridge,
            commands::select_workspace,
            commands::switch_workspace,
            commands::open_path,
            commands::open_external_url,
            commands::desktop_preferences,
            commands::desktop_capabilities,
            commands::set_background_mode,
            commands::set_autostart,
            commands::update_shortcuts,
            commands::check_for_updates,
            commands::install_update,
            commands::set_close_guard_ready,
            commands::exit_app,
        ])
        .setup(|app| {
            let app_data_dir = app.path().app_local_data_dir()?;
            let settings = Arc::new(SettingsStore::load(&app_data_dir)?);
            let mut preferences = settings.get();
            let workspace = if let Some(path) = &preferences.workspace {
                PathBuf::from(path)
            } else {
                let path = app_data_dir.join("workspace");
                std::fs::create_dir_all(&path)?;
                preferences = settings
                    .update(|value| value.workspace = Some(path.to_string_lossy().into_owned()))?;
                path
            };
            let bridge = bridge::BridgeSupervisor::new(&app_data_dir, Some(workspace))?;

            let mut capability_notes = Vec::new();
            let tray_status = match tray::build(app.handle(), preferences.background_mode) {
                Ok(status) => Some(status),
                Err(error) => {
                    capability_notes.push(format!("系统托盘不可用: {error}"));
                    None
                }
            };
            let tray_available = tray_status.is_some();
            let mut shortcut_available = true;
            if preferences.background_mode && tray_available {
                for shortcut in [
                    preferences.show_hide_shortcut.as_str(),
                    preferences.stop_debug_shortcut.as_str(),
                ] {
                    if let Err(error) = app.global_shortcut().register(shortcut) {
                        shortcut_available = false;
                        capability_notes.push(format!("全局快捷键注册失败: {shortcut}: {error}"));
                    }
                }
            }
            #[cfg(target_os = "linux")]
            if std::env::var_os("WAYLAND_DISPLAY").is_some() {
                capability_notes.push(
                    "Wayland 下托盘与全局快捷键取决于桌面环境支持，核心编辑与调试不受影响".into(),
                );
            }
            let capabilities = CapabilityStatus {
                tray: tray_available,
                autostart: true,
                global_shortcut: shortcut_available,
                updater: true,
                notes: capability_notes,
            };
            app.manage(AppState {
                bridge: Arc::clone(&bridge),
                settings: Arc::clone(&settings),
                app_data_dir,
                capabilities,
                close_guard_ready: AtomicBool::new(false),
            });
            bridge.initialize();
            if let Some(status_item) = tray_status {
                tray::start_status_updates(status_item, Arc::clone(&bridge));
            }

            let hidden_arg = std::env::args().any(|value| value == "--hidden");
            if hidden_arg
                && preferences.background_mode
                && preferences.start_hidden
                && tray_available
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide()?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                if state.settings.get().background_mode && state.capabilities.tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else if state.close_guard_ready.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("desktop-close-requested", ());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build MaaPipelineEditor Desktop");

    app.run(|app, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            let state = app.state::<AppState>();
            let _ = state.bridge.shutdown();
        }
    });
}

#[cfg(test)]
mod tests {
    fn close_action(background_mode: bool, tray: bool, guard_ready: bool) -> &'static str {
        if background_mode && tray {
            "hide"
        } else if guard_ready {
            "guard"
        } else {
            "close"
        }
    }

    #[test]
    fn background_window_close_only_hides_when_tray_is_available() {
        assert_eq!(close_action(true, true, true), "hide");
    }

    #[test]
    fn foreground_window_close_uses_frontend_guard_when_ready() {
        assert_eq!(close_action(false, true, true), "guard");
        assert_eq!(close_action(false, false, true), "guard");
    }

    #[test]
    fn startup_close_can_finish_before_frontend_guard_is_ready() {
        assert_eq!(close_action(false, true, false), "close");
    }
}
