use super::*;
use crate::{
    state::State,
    update_cancel::{Scope, Signal},
};
use sha2::{Digest, Sha256};
use std::{
    io::{BufRead, BufReader},
    process::Stdio,
};
use tauri::Manager;

pub fn install(app: &tauri::AppHandle, version: &str) -> Result<Value, String> {
    let m = manifest(app, version)?;
    let version = m["version"].as_str().ok_or("无效版本")?;
    let a = &m["platforms"][platform()]["binary"];
    let url = a["url"]
        .as_str()
        .filter(|s| s.starts_with("https://"))
        .ok_or("无效下载地址")?;
    let state = app.state::<State>();
    let scope = Scope::new(&state.update_cancel);
    let (sender, mut cancelled) = tokio::sync::oneshot::channel();
    scope.control.set_signal(Signal::Async(sender));
    let _ = app.emit_to(
        "launcher",
        "engine-progress",
        json!({
            "phase":"downloading", "artifact":"installer", "downloaded":0, "cancellable":true
        })
        .to_string(),
    );
    let bytes = tauri::async_runtime::block_on(async {
        let request =
            async {
                let mut response = reqwest::Client::builder()
                    .user_agent("MPE-Desktop")
                    .timeout(Duration::from_secs(1800))
                    .build()?
                    .get(url)
                    .send()
                    .await?
                    .error_for_status()?;
                let total = response.content_length();
                let started = std::time::Instant::now();
                let mut last_report = Duration::ZERO;
                let mut bytes = Vec::new();
                while let Some(chunk) = response.chunk().await? {
                    bytes.extend_from_slice(&chunk);
                    let elapsed = started.elapsed();
                    if last_report.is_zero()
                        || elapsed - last_report >= Duration::from_millis(200)
                        || total == Some(bytes.len() as u64)
                    {
                        let _ = app.emit_to("launcher", "engine-progress", json!({
                        "phase":"downloading", "artifact":"installer", "cancellable":true,
                        "downloaded":bytes.len(), "total":total,
                        "elapsedSeconds":elapsed.as_secs_f64(),
                        "bytesPerSecond":bytes.len() as f64 / elapsed.as_secs_f64().max(0.001)
                    }).to_string());
                        last_report = elapsed;
                    }
                }
                Ok::<_, reqwest::Error>(bytes)
            };
        tokio::select! {
            biased;
            _ = &mut cancelled => Ok(None),
            result = request => result.map(Some).map_err(|e| format!("下载安装工具失败：{}", download::describe_error(&e))),
        }
    })?;
    let Some(bytes) = bytes else {
        return Ok(json!({"cancelled":true}));
    };
    if hex::encode(Sha256::digest(&bytes)) != a["sha256"].as_str().unwrap_or("") {
        return Err("安装工具校验失败".into());
    }
    let worker_dir = data_dir(app).join("installer");
    std::fs::create_dir_all(&worker_dir).map_err(|e| e.to_string())?;
    let worker = worker_dir.join(binary_name());
    std::fs::write(&worker, bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&worker, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    let mut child = command(&worker)
        .args([
            "env",
            "install",
            "--with-editor",
            "--download-control",
            "--json",
            "--version",
            version,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    // If cancellation won during bootstrap, dropping stdin makes the worker
    // cancel before it can commit. Otherwise transfer control to the worker.
    scope
        .control
        .set_signal(Signal::Installer(child.stdin.take().unwrap()));
    let stderr = child.stderr.take().unwrap();
    let errors = std::thread::spawn(move || {
        use std::io::Read;
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });
    let mut was_cancelled = false;
    let mut protocol_error = None;
    for line in BufReader::new(child.stdout.take().unwrap()).lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) => {
                protocol_error = Some(error.to_string());
                break;
            }
        };
        crate::logs::record(app, &format!("安装：{line}"));
        if let Ok(mut event) = serde_json::from_str::<Value>(&line) {
            if event["phase"] == "ready_to_install" {
                if let Err(error) = scope.control.finish() {
                    protocol_error = Some(error);
                    break;
                }
                continue;
            }
            was_cancelled |= event["phase"] == "cancelled";
            event["cancellable"] = scope.control.active().into();
            let _ = app.emit_to("launcher", "engine-progress", event.to_string());
        }
    }
    if protocol_error.is_some() {
        let _ = scope.control.cancel();
    }
    let result = child.wait().map_err(|e| e.to_string())?;
    let message = errors.join().unwrap_or_default();
    if !message.trim().is_empty() {
        crate::logs::record(app, &format!("安装输出：{message}"));
    }
    let _ = std::fs::remove_file(worker);
    if let Some(error) = protocol_error {
        return Err(error);
    }
    if !result.success() {
        return Err(message);
    }
    if was_cancelled {
        return Ok(json!({"cancelled":true}));
    }
    check()
}
