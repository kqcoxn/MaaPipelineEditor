use crate::{
    engine, session,
    settings::{self, Project, Settings},
    state::{now, Operation, State},
};
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use tauri::{Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

pub(crate) fn authorize(window: &WebviewWindow, label: &str) -> Result<(), String> {
    let url = window.url().map_err(|e| e.to_string())?;
    if window.label() != label || !allowed_origin(&url, label) {
        return Err("此窗口无权执行操作".into());
    }
    Ok(())
}
fn allowed_origin(url: &tauri::Url, label: &str) -> bool {
    let protocol = match label {
        "launcher" => "tauri",
        "renderer" => "mpe",
        _ => return false,
    };
    let custom =
        url.scheme() == protocol && url.host_str() == Some("localhost") && url.port().is_none();
    let mapped = url.scheme() == "http"
        && url.host_str() == Some(format!("{protocol}.localhost").as_str())
        && url.port().is_none();
    let dev = cfg!(debug_assertions)
        && label == "launcher"
        && url.origin().ascii_serialization() == "http://127.0.0.1:1420";
    custom || mapped || dev
}
async fn work<T: Send + 'static>(
    app: tauri::AppHandle,
    f: impl FnOnce(&tauri::AppHandle) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<State>();
        let _operation = Operation::acquire(&state)?;
        let result = f(&app);
        if let Err(error) = &result {
            crate::logs::record(&app, &format!("操作失败：{error}"));
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn launcher_ready(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    crate::startup::reveal(&app)
}

#[tauri::command]
pub async fn snapshot(window: WebviewWindow, app: tauri::AppHandle) -> Result<Value, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<State>();
        let settings = state.settings.lock().unwrap().clone();
        let running = state.session.lock().unwrap().is_some();
        let environment =
            engine::check().unwrap_or_else(|error| json!({"ready":false,"problems":[error]}));
        let service =
            engine::status().unwrap_or_else(|error| json!({"state":"unknown","error":error}));
        json!({
            "settings": settings,
            "environment": environment,
            "service": service,
            "running": running,
            "busy": state.busy.load(Ordering::SeqCst),
            "desktopVersion": env!("CARGO_PKG_VERSION"),
            "desktopRevision": crate::desktop_release::revision()
        })
    })
    .await
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_settings(
    window: WebviewWindow,
    app: tauri::AppHandle,
    settings: Settings,
) -> Result<(), String> {
    authorize(&window, "launcher")?;
    let state = app.state::<State>();
    settings::save(&app, &settings)?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}
fn choose_directory(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|p| {
            p.into_path()
                .map_err(|e| e.to_string())
                .and_then(|p| p.canonicalize().map_err(|e| e.to_string()))
                .map(|p| p.to_string_lossy().into_owned())
        })
        .transpose()
}
#[tauri::command]
pub async fn add_project(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, |app| {
        if let Some(path) = choose_directory(app)? {
            let state = app.state::<State>();
            let mut s = state.settings.lock().unwrap();
            if !s.projects.iter().any(|p| p.path == path) {
                s.projects.push(Project {
                    name: std::path::Path::new(&path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                    path: path.clone(),
                });
            }
            s.selected_project = path;
            settings::save(app, &s)?;
        }
        Ok(())
    })
    .await
}
#[tauri::command]
pub fn remove_project(
    window: WebviewWindow,
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    authorize(&window, "launcher")?;
    let state = app.state::<State>();
    let mut s = state.settings.lock().unwrap();
    s.projects.retain(|p| p.path != path);
    if s.selected_project == path {
        s.selected_project = s
            .projects
            .first()
            .map(|p| p.path.clone())
            .unwrap_or_default()
    }
    settings::save(&app, &s)
}
#[tauri::command]
pub async fn relocate_project(
    window: WebviewWindow,
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, move |app| {
        if let Some(new) = choose_directory(app)? {
            let state = app.state::<State>();
            let mut s = state.settings.lock().unwrap();
            if s.projects.iter().any(|p| p.path == new) {
                return Err("该目录已在列表中".into());
            }
            if let Some(p) = s.projects.iter_mut().find(|p| p.path == path) {
                p.path = new.clone();
            }
            if s.selected_project == path {
                s.selected_project = new
            }
            settings::save(app, &s)?;
        }
        Ok(())
    })
    .await
}
#[tauri::command]
pub async fn check_environment(
    window: WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    authorize(&window, "launcher")?;
    work(app, |app| {
        if settings::engine_dir().join(".mpe-transaction").exists() {
            engine::recover(app)?
        }
        engine::check()
    })
    .await
}
#[tauri::command]
pub async fn install_environment(
    window: WebviewWindow,
    app: tauri::AppHandle,
    version: String,
) -> Result<Value, String> {
    authorize(&window, "launcher")?;
    work(app, move |app| {
        let state = app.state::<State>();
        if state.session.lock().unwrap().is_some() {
            return Err("结束编辑后才能更新".into());
        }
        if engine::status()?["state"] != "stopped" {
            return Err("已有服务运行，请先处理实例冲突".into());
        }
        engine::install(app, &version)
    })
    .await
}
#[tauri::command]
pub async fn start_editor(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, |app| {
        let root = app
            .state::<State>()
            .settings
            .lock()
            .unwrap()
            .selected_project
            .clone();
        session::start(app, root)
    })
    .await
}
#[tauri::command]
pub async fn stop_conflict(
    window: WebviewWindow,
    app: tauri::AppHandle,
    id: String,
    force: bool,
) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, move |app| {
        let state = app.state::<State>();
        let own = state.session.lock().unwrap().is_some();
        if own && !force {
            session::request_close(app, false);
            return Ok(());
        }
        engine::stop(&id, force)?;
        if own {
            state.session.lock().unwrap().take();
            if let Some(w) = app.get_webview_window("renderer") {
                let _ = w.destroy();
            }
            state.closing.store(false, Ordering::SeqCst);
            state.exiting.store(false, Ordering::SeqCst);
            session::show_launcher(app);
        }
        Ok(())
    })
    .await
}
#[tauri::command]
pub async fn open_config(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, |_| {
        let out = engine::command(&settings::engine_dir().join(settings::binary_name()))
            .args(["config", "open"])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).into())
        }
    })
    .await
}
#[tauri::command]
pub fn open_link(window: WebviewWindow, app: tauri::AppHandle, url: String) -> Result<(), String> {
    authorize(
        &window,
        if window.label() == "renderer" {
            "renderer"
        } else {
            "launcher"
        },
    )?;
    if !url.starts_with("https://") {
        return Err("仅支持 HTTPS 链接".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn choose_background(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, |app| {
        if let Some(path) = app
            .dialog()
            .file()
            .add_filter("图片", &["png", "jpg", "jpeg", "webp"])
            .blocking_pick_file()
        {
            let path = path.into_path().map_err(|e| e.to_string())?;
            if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
                return Err("背景图片不能超过 20 MB".into());
            }
            std::fs::copy(path, settings::data_dir(app).join("background"))
                .map_err(|e| e.to_string())?;
            let state = app.state::<State>();
            let mut s = state.settings.lock().unwrap();
            s.background = true;
            settings::save(app, &s)?;
        }
        Ok(())
    })
    .await
}
#[tauri::command]
pub async fn homepage(window: WebviewWindow, app: tauri::AppHandle) -> Result<Value, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || crate::content::load(&app))
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn release_versions(
    window: WebviewWindow,
    app: tauri::AppHandle,
    force: bool,
) -> Result<crate::releases::VersionList, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = crate::releases::load(&settings::data_dir(&app), force);
        match &result {
            Ok(list) => crate::logs::record(
                &app,
                &format!(
                    "版本检查：{} 个可安装版本{}",
                    list.versions.len(),
                    list.warning
                        .as_ref()
                        .map(|warning| format!("；{warning}"))
                        .unwrap_or_default()
                ),
            ),
            Err(error) => crate::logs::record(&app, &format!("版本检查失败：{error}")),
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn github_token_status(window: WebviewWindow) -> Result<bool, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(|| crate::credentials::read().map(|v| v.is_some()))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn release_notes(window: WebviewWindow, version: String) -> Result<String, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || crate::releases::notes(&version))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn save_github_token(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
) -> Result<(), String> {
    authorize(&window, "launcher")?;
    work(app, move |app| {
        crate::releases::save_token(&settings::data_dir(app), &token)
    })
    .await
}
#[tauri::command]
pub async fn update_desktop(
    window: WebviewWindow,
    app: tauri::AppHandle,
) -> Result<String, String> {
    authorize(&window, "launcher")?;
    let state = app.state::<State>();
    let _operation = Operation::acquire(&state)?;
    if state.session.lock().unwrap().is_some() {
        return Err("结束编辑后才能更新 MPE Desktop".into());
    }
    use tauri_plugin_updater::UpdaterExt;
    if option_env!("MPE_UPDATER_PUBLIC_KEY")
        .unwrap_or("")
        .is_empty()
    {
        return Ok("此构建未配置正式更新签名".into());
    }
    let updater = app
        .updater_builder()
        // Read the revision from the exact manifest returned by this check.
        .version_comparator(|_, _| true)
        .pubkey(option_env!("MPE_UPDATER_PUBLIC_KEY").unwrap_or(""))
        .endpoints(vec![format!(
            "{}/latest/download/mpe-desktop-updater.json",
            engine::RELEASES
        )
        .parse()
        .map_err(|e| format!("{e}"))?])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        if !crate::desktop_release::needs_update(
            &update.raw_json,
            crate::desktop_release::revision(),
        )? {
            return Ok("MPE Desktop 已是最新修订版".into());
        }
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        state.busy.store(false, Ordering::SeqCst);
        // Tauri spawns the replacement process before exiting this one.
        fs2::FileExt::unlock(&app.state::<crate::state::InstanceLock>().0)
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok("MPE Desktop 已是最新版本".into())
}
#[tauri::command]
pub fn quit_desktop(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    if app.state::<State>().busy.load(Ordering::SeqCst) {
        return Err("请等待当前操作完成".into());
    }
    session::request_close(&app, true);
    Ok(())
}
#[tauri::command]
pub async fn desktop_open_devtools(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, "renderer")?;
    window.open_devtools();
    Ok(())
}
#[tauri::command]
pub async fn desktop_reply(
    window: WebviewWindow,
    app: tauri::AppHandle,
    accept: bool,
) -> Result<(), String> {
    authorize(&window, "renderer")?;
    work(app, move |app| session::finish(app, accept)).await
}
#[tauri::command]
pub fn desktop_heartbeat(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "renderer")?;
    app.state::<State>()
        .heartbeat
        .store(now(), Ordering::SeqCst);
    if app.state::<State>().closing.load(Ordering::SeqCst) {
        use tauri::Emitter;
        let _ = window.emit("desktop-close-request", ());
    }
    Ok(())
}
#[tauri::command]
pub async fn desktop_save_path(
    window: WebviewWindow,
    app: tauri::AppHandle,
    name: String,
) -> Result<Option<String>, String> {
    authorize(&window, "renderer")?;
    tauri::async_runtime::spawn_blocking(move || {
        let root = app
            .state::<State>()
            .session
            .lock()
            .unwrap()
            .as_ref()
            .map(|s| s.root.clone())
            .ok_or("会话已结束")?;
        let path = app
            .dialog()
            .file()
            .set_directory(&root)
            .set_file_name(name.replace(['/', '\\'], "_"))
            .add_filter("Pipeline", &["json", "jsonc"])
            .blocking_save_file();
        path.map(|p| {
            p.into_path().map_err(|e| e.to_string()).and_then(|p| {
                let parent = p
                    .parent()
                    .ok_or("无效路径")?
                    .canonicalize()
                    .map_err(|e| e.to_string())?;
                if !parent.starts_with(&root) {
                    return Err("请保存到当前项目目录内".into());
                }
                Ok(p.to_string_lossy().into_owned())
            })
        })
        .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn separates_launcher_and_renderer_origins() {
        let url = |value: &str| tauri::Url::parse(value).unwrap();
        assert!(allowed_origin(
            &url("mpe://localhost/index.html"),
            "renderer"
        ));
        assert!(allowed_origin(&url("http://tauri.localhost"), "launcher"));
        assert!(!allowed_origin(&url("http://mpe.localhost"), "launcher"));
        assert!(!allowed_origin(&url("mpe://external.example"), "renderer"));
        assert!(!allowed_origin(&url("http://127.0.0.1:1420"), "renderer"));
    }
}
