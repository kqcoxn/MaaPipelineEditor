use std::sync::Arc;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use crate::bridge::BridgeSupervisor;
use crate::commands::AppState;
use crate::error::{AppError, AppResult};

const TRAY_ID: &str = "main-tray";

pub fn build(app: &AppHandle, visible: bool) -> AppResult<MenuItem<tauri::Wry>> {
    let toggle =
        MenuItem::with_id(app, "toggle", "显示/隐藏", true, None::<&str>).map_err(desktop_error)?;
    let status = MenuItem::with_id(app, "status", "LocalBridge 状态", false, None::<&str>)
        .map_err(desktop_error)?;
    let stop = MenuItem::with_id(app, "stop", "停止当前调试", true, None::<&str>)
        .map_err(desktop_error)?;
    let separator = PredefinedMenuItem::separator(app).map_err(desktop_error)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>).map_err(desktop_error)?;
    let menu = Menu::with_items(app, &[&toggle, &status, &stop, &separator, &quit])
        .map_err(desktop_error)?;
    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(
            app.default_window_icon()
                .ok_or_else(|| AppError::Desktop("缺少应用图标".into()))?
                .clone(),
        )
        .tooltip("MaaPipelineEditor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_window(app),
            "stop" => {
                let _ = app.emit("desktop-stop-debug", ());
            }
            "quit" => {
                let state = app.state::<AppState>();
                let bridge = Arc::clone(&state.bridge);
                let app = app.clone();
                std::thread::spawn(move || {
                    let _ = bridge.shutdown();
                    app.exit(0);
                });
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)
        .map_err(desktop_error)?;
    tray.set_visible(visible).map_err(desktop_error)?;
    Ok(status)
}

pub fn start_status_updates(status_item: MenuItem<tauri::Wry>, bridge: Arc<BridgeSupervisor>) {
    std::thread::spawn(move || {
        let mut previous = String::new();
        loop {
            let status = bridge.status();
            let label = format!("LocalBridge: {}", status.message);
            if label != previous {
                let _ = status_item.set_text(&label);
                previous = label;
            }
            std::thread::sleep(std::time::Duration::from_millis(750));
        }
    });
}

pub fn set_visible(app: &AppHandle, visible: bool) -> AppResult<()> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| AppError::Desktop("托盘尚未初始化".into()))?;
    tray.set_visible(visible).map_err(desktop_error)
}

pub fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        toggle(&window);
    }
}

fn toggle(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn desktop_error(error: impl std::fmt::Display) -> AppError {
    AppError::Desktop(error.to_string())
}
