use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

use crate::bridge::BridgeSupervisor;
use crate::error::{AppError, AppResult};
use crate::models::{BridgeStatus, CapabilityStatus, DesktopPreferences, LocalBridgeBootstrap};
use crate::settings::SettingsStore;
use crate::tray;

pub struct AppState {
    pub bridge: Arc<BridgeSupervisor>,
    pub settings: Arc<SettingsStore>,
    pub app_data_dir: PathBuf,
    pub capabilities: CapabilityStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn localbridge_bootstrap(state: State<'_, AppState>) -> AppResult<LocalBridgeBootstrap> {
    let bridge = Arc::clone(&state.bridge);
    tauri::async_runtime::spawn_blocking(move || bridge.bootstrap(Duration::from_secs(180)))
        .await
        .map_err(|error| AppError::Bridge(format!("等待 LocalBridge 任务失败: {error}")))?
}

#[tauri::command]
pub fn localbridge_status(state: State<'_, AppState>) -> BridgeStatus {
    state.bridge.status()
}

#[tauri::command]
pub async fn restart_localbridge(state: State<'_, AppState>) -> AppResult<()> {
    let bridge = Arc::clone(&state.bridge);
    tauri::async_runtime::spawn_blocking(move || bridge.restart())
        .await
        .map_err(|error| AppError::Bridge(format!("重启任务失败: {error}")))?
}

#[tauri::command]
pub async fn repair_localbridge(state: State<'_, AppState>) -> AppResult<()> {
    let bridge = Arc::clone(&state.bridge);
    tauri::async_runtime::spawn_blocking(move || bridge.repair())
        .await
        .map_err(|error| AppError::Bridge(format!("修复任务失败: {error}")))?
}

#[tauri::command]
pub fn select_workspace(app: AppHandle) -> AppResult<Option<String>> {
    let selected = app.dialog().file().blocking_pick_folder();
    selected
        .map(|value| {
            value
                .into_path()
                .map(|path| path.to_string_lossy().into_owned())
                .map_err(|error| AppError::Desktop(error.to_string()))
        })
        .transpose()
}

#[tauri::command]
pub async fn switch_workspace(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<DesktopPreferences> {
    let workspace = PathBuf::from(path).canonicalize()?;
    if !workspace.is_dir() {
        return Err(AppError::Desktop("工作区必须是已存在的目录".into()));
    }
    let preferences = state
        .settings
        .update(|value| value.workspace = Some(workspace.to_string_lossy().into_owned()))?;
    let bridge = Arc::clone(&state.bridge);
    tauri::async_runtime::spawn_blocking(move || bridge.set_workspace(workspace))
        .await
        .map_err(|error| AppError::Bridge(format!("切换工作区任务失败: {error}")))??;
    Ok(preferences)
}

#[tauri::command]
pub fn open_path(path: String, app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    let target = PathBuf::from(path).canonicalize()?;
    let mut allowed_roots = vec![state.app_data_dir.canonicalize()?];
    if let Some(workspace) = state.settings.get().workspace {
        allowed_roots.push(PathBuf::from(workspace).canonicalize()?);
    }
    if !allowed_roots
        .iter()
        .any(|root| path_is_within(&target, root))
    {
        return Err(AppError::Desktop(
            "只允许打开工作区或应用数据目录内的路径".into(),
        ));
    }
    app.opener()
        .open_path(target.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| AppError::Desktop(error.to_string()))
}

#[tauri::command]
pub fn open_external_url(url: String, app: AppHandle) -> AppResult<()> {
    const ALLOWED_PREFIXES: [&str; 2] = ["https://www.python.org/", "https://docs.python.org/"];
    if !ALLOWED_PREFIXES
        .iter()
        .any(|prefix| url.starts_with(prefix))
    {
        return Err(AppError::Desktop("该外部链接不在允许列表中".into()));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| AppError::Desktop(error.to_string()))
}

#[tauri::command]
pub fn desktop_preferences(state: State<'_, AppState>) -> DesktopPreferences {
    state.settings.get()
}

#[tauri::command]
pub fn desktop_capabilities(state: State<'_, AppState>) -> CapabilityStatus {
    state.capabilities.clone()
}

#[tauri::command]
pub fn set_background_mode(
    enabled: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<DesktopPreferences> {
    let current = state.settings.get();
    if enabled && !state.capabilities.tray {
        return Err(AppError::Desktop(
            "当前桌面环境不支持系统托盘，无法启用后台驻留".into(),
        ));
    }
    if enabled && !current.background_mode {
        if let Err(error) = register_shortcuts(&app, &current) {
            let _ = unregister_shortcuts(&app, &current);
            return Err(error);
        }
    } else if !enabled && current.background_mode {
        unregister_shortcuts(&app, &current)?;
    }
    let preferences = state.settings.update(|value| {
        value.background_mode = enabled;
        if !enabled {
            value.start_hidden = false;
            value.autostart = false;
        }
    })?;
    if state.capabilities.tray {
        tray::set_visible(&app, enabled)?;
    }
    if !enabled && app.autolaunch().is_enabled().unwrap_or(false) {
        app.autolaunch()
            .disable()
            .map_err(|error| AppError::Desktop(error.to_string()))?;
    }
    Ok(preferences)
}

#[tauri::command]
pub fn set_autostart(
    enabled: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<DesktopPreferences> {
    if enabled && !state.settings.get().background_mode {
        return Err(AppError::Desktop("启用开机启动前必须先启用后台驻留".into()));
    }
    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|error| AppError::Desktop(error.to_string()))?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| AppError::Desktop(error.to_string()))?;
    }
    state.settings.update(|value| {
        value.autostart = enabled;
        value.start_hidden = enabled;
    })
}

#[tauri::command]
pub fn update_shortcuts(
    show_hide: String,
    stop_debug: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<DesktopPreferences> {
    let previous = state.settings.get();
    if !previous.background_mode {
        return state.settings.update(|value| {
            value.show_hide_shortcut = show_hide;
            value.stop_debug_shortcut = stop_debug;
        });
    }
    app.global_shortcut()
        .unregister(previous.show_hide_shortcut.as_str())
        .map_err(|error| AppError::Desktop(error.to_string()))?;
    app.global_shortcut()
        .unregister(previous.stop_debug_shortcut.as_str())
        .map_err(|error| AppError::Desktop(error.to_string()))?;
    let register_result = app
        .global_shortcut()
        .register(show_hide.as_str())
        .and_then(|_| app.global_shortcut().register(stop_debug.as_str()));
    if let Err(error) = register_result {
        let _ = app.global_shortcut().unregister(show_hide.as_str());
        let _ = app.global_shortcut().unregister(stop_debug.as_str());
        let _ = app
            .global_shortcut()
            .register(previous.show_hide_shortcut.as_str());
        let _ = app
            .global_shortcut()
            .register(previous.stop_debug_shortcut.as_str());
        return Err(AppError::Desktop(format!(
            "快捷键注册冲突，已保留原设置: {error}"
        )));
    }
    state.settings.update(|value| {
        value.show_hide_shortcut = show_hide;
        value.stop_debug_shortcut = stop_debug;
    })
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> AppResult<UpdateStatus> {
    let update = app
        .updater()
        .map_err(|error| AppError::Desktop(error.to_string()))?
        .check()
        .await
        .map_err(|error| AppError::Desktop(error.to_string()))?;
    Ok(UpdateStatus {
        available: update.is_some(),
        current_version: app.package_info().version.to_string(),
        version: update.as_ref().map(|value| value.version.clone()),
        notes: update.and_then(|value| value.body),
    })
}

#[tauri::command]
pub async fn install_update(
    confirmed: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<bool> {
    if !confirmed {
        return Err(AppError::Desktop("安装更新必须由用户明确确认".into()));
    }
    let Some(update) = app
        .updater()
        .map_err(|error| AppError::Desktop(error.to_string()))?
        .check()
        .await
        .map_err(|error| AppError::Desktop(error.to_string()))?
    else {
        return Ok(false);
    };
    let version = update.version.clone();
    let bridge = Arc::clone(&state.bridge);
    tauri::async_runtime::spawn_blocking(move || bridge.prepare_version(&version))
        .await
        .map_err(|error| AppError::Python(format!("准备更新环境任务失败: {error}")))??;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| AppError::Desktop(error.to_string()))?;
    let bridge = Arc::clone(&state.bridge);
    tauri::async_runtime::spawn_blocking(move || bridge.shutdown())
        .await
        .map_err(|error| AppError::Bridge(format!("更新前停止 LocalBridge 失败: {error}")))??;
    app.restart()
}

#[tauri::command]
pub fn exit_app(app: AppHandle, state: State<'_, AppState>) {
    let bridge = Arc::clone(&state.bridge);
    std::thread::spawn(move || {
        let _ = bridge.shutdown();
        app.exit(0);
    });
}

pub fn path_is_within(path: &Path, root: &Path) -> bool {
    path.starts_with(root)
}

fn register_shortcuts(app: &AppHandle, preferences: &DesktopPreferences) -> AppResult<()> {
    app.global_shortcut()
        .register(preferences.show_hide_shortcut.as_str())
        .and_then(|_| {
            app.global_shortcut()
                .register(preferences.stop_debug_shortcut.as_str())
        })
        .map_err(|error| AppError::Desktop(format!("全局快捷键注册失败: {error}")))
}

fn unregister_shortcuts(app: &AppHandle, preferences: &DesktopPreferences) -> AppResult<()> {
    app.global_shortcut()
        .unregister(preferences.show_hide_shortcut.as_str())
        .map_err(|error| AppError::Desktop(error.to_string()))?;
    app.global_shortcut()
        .unregister(preferences.stop_debug_shortcut.as_str())
        .map_err(|error| AppError::Desktop(error.to_string()))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::path_is_within;

    #[test]
    fn path_allowlist_accepts_descendants_and_rejects_sibling_prefixes() {
        let root = Path::new("C:/application/data");

        assert!(path_is_within(
            Path::new("C:/application/data/logs/bridge.log"),
            root
        ));
        assert!(!path_is_within(
            Path::new("C:/application/database/secret.log"),
            root
        ));
    }
}
