use crate::{
    engine,
    state::{Operation, State},
};
use serde_json::{json, Value};
use std::{
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager};
use tauri_plugin_updater::UpdaterExt;

pub async fn run(app: tauri::AppHandle, on_progress: Channel<Value>) -> Result<String, String> {
    let state = app.state::<State>();
    let _operation = Operation::acquire(&state)?;
    if state.session.lock().unwrap().is_some() {
        return Err("结束编辑后才能更新 MPE Desktop".into());
    }
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
    let (cancel, cancelled) = tokio::sync::oneshot::channel();
    *state.update_check.lock().unwrap() = Some(cancel);
    let _ = on_progress.send(json!({"artifact": "desktop", "phase": "checking"}));
    let checked = tokio::select! {
        biased;
        _ = cancelled => Ok(None),
        result = tokio::time::timeout(Duration::from_secs(30), updater.check()) => {
            result.map_err(|_| "桌面端检测超时，请检查网络后重试".to_string())
                .and_then(|result| result.map_err(|e| e.to_string()))
        }
    };
    // Taking the sender also closes the cancellation window before downloading.
    if state.update_check.lock().unwrap().take().is_none() {
        return Ok("已取消检测，可启动当前版本".into());
    }
    if let Some(update) = checked? {
        if !crate::desktop_release::needs_update(
            &update.raw_json,
            crate::desktop_release::revision(),
        )? {
            return Ok("MPE Desktop 已是最新修订版".into());
        }
        let started = Instant::now();
        let mut downloaded = 0_u64;
        let mut last_report = None;
        let _ = on_progress.send(json!({
            "artifact": "desktop", "phase": "downloading", "downloaded": 0
        }));
        let bytes = update
            .download(
                |chunk_length, total| {
                    downloaded += chunk_length as u64;
                    let elapsed = started.elapsed();
                    // Limit IPC traffic while keeping the first and final chunks visible.
                    if last_report.is_none_or(|last| elapsed - last >= Duration::from_millis(200))
                        || total == Some(downloaded)
                    {
                        let _ = on_progress.send(json!({
                            "artifact": "desktop",
                            "phase": "downloading",
                            "downloaded": downloaded,
                            "total": total,
                            "elapsedSeconds": elapsed.as_secs_f64(),
                            "bytesPerSecond": downloaded as f64 / elapsed.as_secs_f64().max(0.001)
                        }));
                        last_report = Some(elapsed);
                    }
                },
                || {
                    // The plugin verifies the signature after this callback.
                    let _ = on_progress.send(json!({"artifact": "desktop", "phase": "verifying"}));
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        let _ = on_progress.send(json!({"artifact": "desktop", "phase": "installing"}));
        update.install(bytes).map_err(|e| e.to_string())?;
        let _ = on_progress.send(json!({"artifact": "desktop", "phase": "restarting"}));
        state.busy.store(false, Ordering::SeqCst);
        // Tauri spawns the replacement process before exiting this one.
        fs2::FileExt::unlock(&app.state::<crate::state::InstanceLock>().0)
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok("MPE Desktop 已是最新版本".into())
}
