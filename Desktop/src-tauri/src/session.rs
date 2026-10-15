mod lifecycle;
pub use lifecycle::{aborted, complete, finish, monitor, request_close, show_launcher, stop};

use crate::{
    engine,
    settings::{binary_name, engine_dir},
    state::{now, Session, State},
};
use serde_json::{json, Value};
use std::{
    process::Stdio,
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn start(app: &tauri::AppHandle, root: String) -> Result<(), String> {
    let state = app.state::<State>();
    if state.session.lock().unwrap().is_some() {
        return Err("编辑器已在运行".into());
    }
    let environment = engine::check()?;
    if environment["ready"] != true {
        return Err("请先在环境管理中准备完整环境".into());
    }
    let fixed = state.settings.lock().unwrap().fixed_version.clone();
    if fixed.is_some_and(|v| environment["version"] != v) {
        return Err("全局环境与固定版本不同，请在环境管理中安装所选版本".into());
    }
    let status = engine::status()?;
    if status["state"] != "stopped" {
        return Err(format!(
            "已有 mpelb 正在运行（{}）",
            status["root"].as_str().unwrap_or("")
        ));
    }
    let path = std::path::PathBuf::from(&root)
        .canonicalize()
        .map_err(|_| "项目目录不存在，请重新定位")?;
    if !path.is_dir() {
        return Err("请选择项目目录".into());
    }
    let root = path.to_string_lossy().to_string();
    crate::logs::record(app, "正在启动编辑器与托管 LocalBridge");
    let current_log = engine::log_path(app);
    if current_log.exists() {
        std::fs::copy(
            &current_log,
            crate::settings::data_dir(app).join("mpelb.previous.log"),
        )
        .map_err(|e| format!("保留上次会话日志失败：{e}"))?;
    }
    let log = std::fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(engine::log_path(app))
        .map_err(|e| e.to_string())?;
    let mut child = engine::command(&engine_dir().join(binary_name()))
        .args(["--root", &root, "--managed"])
        .env("MPE_DESKTOP_LOG_DIR", crate::settings::data_dir(app))
        .stdin(Stdio::piped())
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log))
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    let job = match crate::windows_job::Job::attach(&child) {
        Ok(job) => job,
        Err(err) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(err);
        }
    };
    let deadline = Instant::now() + Duration::from_secs(60);
    let ready: Result<Value, String> = (|| loop {
        if let Some(code) = child.try_wait().map_err(|e| e.to_string())? {
            return Err(format!("mpelb 启动失败 {code}，请查看日志"));
        }
        if let Ok(s) = engine::status() {
            if s["pid"].as_u64() == Some(child.id() as u64) && s["state"] == "ready" {
                if s["version"] != environment["version"] {
                    return Err("前后端安装版本不一致，请修复环境".into());
                }
                return Ok(s);
            }
        }
        if Instant::now() > deadline {
            return Err("mpelb 启动超时".into());
        }
        std::thread::sleep(Duration::from_millis(200));
    })();
    let ready = match ready {
        Ok(s) => s,
        Err(err) => {
            drop(child.stdin.take());
            let _ = child.kill();
            let _ = child.wait();
            return Err(err);
        }
    };
    let address = ready["address"].as_str().ok_or("缺少服务地址")?;
    let bootstrap = json!({"address":address,"root":root,"version":environment["version"],"projectKey":hex::encode(sha2::Sha256::digest(root.as_bytes()))});
    use sha2::Digest;
    let port = address.rsplit(':').next().unwrap_or("9066");
    let url = format!("mpe://localhost/index.html?link_lb=true&port={port}");
    let result = WebviewWindowBuilder::new(
        app,
        "renderer",
        WebviewUrl::CustomProtocol(url.parse().map_err(|e| format!("{e}"))?),
    )
    .title("MPE Desktop - Editor")
    .inner_size(1440.0, 900.0)
    .center()
    .devtools(true)
    .initialization_script(include_str!("renderer-shortcuts.js"))
    .initialization_script(format!(
        "Object.defineProperty(window, '__MPE_DESKTOP__', {{ value: {}, writable: false }});",
        bootstrap
    ))
    .on_navigation(|url| {
        (url.scheme() == "mpe" && url.host_str() == Some("localhost"))
            || (url.scheme() == "http" && url.host_str() == Some("mpe.localhost"))
    })
    .build();
    let renderer = match result {
        Ok(window) => window,
        Err(err) => {
            drop(child.stdin.take());
            let _ = child.kill();
            let _ = child.wait();
            return Err(err.to_string());
        }
    };
    *state.session.lock().unwrap() = Some(Session {
        address: address.into(),
        child,
        id: ready["id"].as_str().unwrap_or_default().into(),
        root,
        stop_reason: None,
        #[cfg(windows)]
        _job: job,
    });
    state.heartbeat.store(now(), Ordering::SeqCst);
    crate::crash::watch(&renderer);
    if state.settings.lock().unwrap().hide_launcher {
        if let Some(window) = app.get_webview_window("launcher") {
            let _ = window.hide();
        }
    }
    let _ = renderer.set_focus();
    crate::logs::record(app, "编辑器已启动，LocalBridge 已就绪");
    let _ = app.emit_to("launcher", "session-changed", true);
    Ok(())
}
