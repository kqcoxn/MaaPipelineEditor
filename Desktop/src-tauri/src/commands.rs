use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
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
    pub close_guard_ready: AtomicBool,
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
    let workspace = validate_workspace_path(Path::new(&path))?;
    let bridge = Arc::clone(&state.bridge);
    let settings = Arc::clone(&state.settings);
    tauri::async_runtime::spawn_blocking(move || {
        switch_workspace_transaction(&bridge, &settings, workspace)
    })
    .await
    .map_err(|error| AppError::Bridge(format!("切换工作区任务失败: {error}")))?
}

fn validate_workspace_path(path: &Path) -> AppResult<PathBuf> {
    let workspace = path.canonicalize()?;
    if !workspace.is_dir() {
        return Err(AppError::Desktop("工作区必须是已存在的目录".into()));
    }
    Ok(workspace)
}

fn switch_workspace_transaction(
    bridge: &BridgeSupervisor,
    settings: &SettingsStore,
    workspace: PathBuf,
) -> AppResult<DesktopPreferences> {
    let previous_workspace = bridge.workspace();
    run_workspace_switch(
        previous_workspace,
        workspace,
        |target| bridge.set_workspace(target),
        |target| {
            settings.update(|value| {
                value.workspace = Some(target.to_string_lossy().into_owned());
            })
        },
    )
}

fn run_workspace_switch<T>(
    previous_workspace: Option<PathBuf>,
    workspace: PathBuf,
    mut apply_workspace: impl FnMut(Option<PathBuf>) -> AppResult<()>,
    persist_workspace: impl FnOnce(&Path) -> AppResult<T>,
) -> AppResult<T> {
    if let Err(error) = apply_workspace(Some(workspace.clone())) {
        let rollback = apply_workspace(previous_workspace);
        return Err(workspace_switch_error(
            "启动新 LocalBridge",
            error,
            rollback,
        ));
    }
    match persist_workspace(&workspace) {
        Ok(value) => Ok(value),
        Err(error) => {
            let rollback = apply_workspace(previous_workspace);
            Err(workspace_switch_error("写入桌面偏好", error, rollback))
        }
    }
}

fn workspace_switch_error(stage: &str, error: AppError, rollback: AppResult<()>) -> AppError {
    let rollback_result = match rollback {
        Ok(()) => "旧工作区已恢复".to_string(),
        Err(rollback_error) => format!("旧工作区恢复失败: {rollback_error}"),
    };
    AppError::Desktop(format!("{stage}失败: {error}; 回滚结果: {rollback_result}"))
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
pub fn set_close_guard_ready(ready: bool, state: State<'_, AppState>) {
    state.close_guard_ready.store(ready, Ordering::SeqCst);
}

#[tauri::command]
pub fn exit_app(app: AppHandle, state: State<'_, AppState>) {
    state.close_guard_ready.store(false, Ordering::SeqCst);
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
    use std::cell::RefCell;
    use std::path::{Path, PathBuf};

    use tempfile::tempdir;

    use super::{path_is_within, run_workspace_switch, validate_workspace_path};
    use crate::error::AppError;

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

    #[test]
    fn workspace_path_validation_accepts_directories_and_rejects_files() {
        let directory = tempdir().expect("tempdir should be created");
        let file = directory.path().join("pipeline.json");
        std::fs::write(&file, "{}").expect("test file should be written");

        assert_eq!(
            validate_workspace_path(directory.path()).expect("directory should be valid"),
            directory
                .path()
                .canonicalize()
                .expect("path should canonicalize")
        );
        assert!(validate_workspace_path(&file).is_err());
        assert!(validate_workspace_path(&directory.path().join("missing")).is_err());
    }

    #[test]
    fn workspace_switch_persists_only_after_new_bridge_is_ready() {
        let calls = RefCell::new(Vec::new());
        let previous = PathBuf::from("old");
        let next = PathBuf::from("next");

        let result = run_workspace_switch(
            Some(previous),
            next.clone(),
            |workspace| {
                calls.borrow_mut().push(format!("bridge:{workspace:?}"));
                Ok(())
            },
            |workspace| {
                calls.borrow_mut().push(format!("persist:{workspace:?}"));
                Ok("saved")
            },
        )
        .expect("switch should succeed");

        assert_eq!(result, "saved");
        assert_eq!(
            calls.into_inner(),
            vec![
                format!("bridge:{:?}", Some(next.clone())),
                format!("persist:{next:?}"),
            ]
        );
    }

    #[test]
    fn workspace_switch_rolls_back_after_launch_failure() {
        let previous = PathBuf::from("old");
        let next = PathBuf::from("next");
        let calls = RefCell::new(Vec::new());
        let mut attempt = 0;

        let error = run_workspace_switch(
            Some(previous.clone()),
            next.clone(),
            |workspace| {
                calls.borrow_mut().push(workspace.clone());
                attempt += 1;
                if attempt == 1 {
                    Err(AppError::Bridge("new launch failed".into()))
                } else {
                    Ok(())
                }
            },
            |_| -> Result<(), AppError> { panic!("preferences must not be persisted") },
        )
        .expect_err("switch should fail");

        assert_eq!(calls.into_inner(), vec![Some(next), Some(previous)]);
        assert!(error.to_string().contains("旧工作区已恢复"));
    }

    #[test]
    fn workspace_switch_rolls_back_after_preference_write_failure() {
        let previous = PathBuf::from("old");
        let next = PathBuf::from("next");
        let calls = RefCell::new(Vec::new());

        let error = run_workspace_switch(
            Some(previous.clone()),
            next.clone(),
            |workspace| {
                calls.borrow_mut().push(workspace);
                Ok(())
            },
            |_| -> Result<(), AppError> {
                Err(AppError::Desktop("preferences are read-only".into()))
            },
        )
        .expect_err("switch should fail");

        assert_eq!(calls.into_inner(), vec![Some(next), Some(previous)]);
        assert!(error.to_string().contains("写入桌面偏好失败"));
        assert!(error.to_string().contains("旧工作区已恢复"));
    }
}
