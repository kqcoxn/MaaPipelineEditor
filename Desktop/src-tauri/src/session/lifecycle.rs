use crate::{
    engine,
    state::{now, Operation, State, StopReason},
};
use std::{sync::atomic::Ordering, time::Duration};
use tauri::{Emitter, Manager};

pub fn request_close(app: &tauri::AppHandle, exit: bool) {
    let state = app.state::<State>();
    if exit {
        state.exiting.store(true, Ordering::SeqCst)
    }
    if let Some(window) = app.get_webview_window("renderer") {
        if !state.closing.swap(true, Ordering::SeqCst) {
            let _ = window.emit("desktop-close-request", ());
        }
    } else if state.session.lock().unwrap().is_none() {
        app.exit(0)
    }
}
pub fn finish(app: &tauri::AppHandle, accept: bool) -> Result<(), String> {
    let state = app.state::<State>();
    if !accept {
        state.closing.store(false, Ordering::SeqCst);
        state.exiting.store(false, Ordering::SeqCst);
        return Ok(());
    }
    let id = state.session.lock().unwrap().as_ref().map(|s| s.id.clone());
    if let Some(id) = id {
        if let Err(err) = stop(app, &id, StopReason::EditorClosed) {
            state.closing.store(false, Ordering::SeqCst);
            show_launcher(app);
            let _ = app.emit_to("launcher", "session-error", err.clone());
            return Err(err);
        }
    }
    complete(app, StopReason::EditorClosed)
}

pub fn stop(app: &tauri::AppHandle, id: &str, reason: StopReason) -> Result<(), String> {
    engine::stop(id, reason == StopReason::Forced, || {
        let state = app.state::<State>();
        if let Some(session) = state
            .session
            .lock()
            .unwrap()
            .as_mut()
            .filter(|s| s.id == id)
        {
            // Keep the accepted stop intent after a wait timeout. `closing`
            // only guards the current editor confirmation / stop operation.
            session.stop_reason = Some(reason);
        };
        crate::logs::record(app, &format!("已请求停止 LocalBridge（{reason:?}）"));
    })
}

pub fn complete(app: &tauri::AppHandle, reason: StopReason) -> Result<(), String> {
    let state = app.state::<State>();
    let mut exit_error = None;
    if let Some(mut session) = state.session.lock().unwrap().take() {
        match session.child.wait() {
            Ok(status) => exit_error = session.exit_error(status),
            Err(err) => exit_error = Some(format!("无法确认 LocalBridge 退出状态：{err}")),
        }
    }
    if let Some(window) = app.get_webview_window("renderer") {
        let _ = window.destroy();
    }
    state.closing.store(false, Ordering::SeqCst);
    let exit_requested = state.exiting.swap(false, Ordering::SeqCst);
    if let Some(error) = exit_error {
        crate::logs::record(app, &error);
        show_launcher(app);
        let _ = app.emit_to("launcher", "session-error", error.clone());
        return Err(error);
    }
    let should_exit = reason == StopReason::EditorClosed
        && (exit_requested || state.settings.lock().unwrap().exit_after_editor);
    crate::logs::record(app, "编辑会话已结束，LocalBridge 已停止");
    if should_exit {
        state.busy.store(false, Ordering::SeqCst);
        app.exit(0)
    } else {
        show_launcher(app);
        let _ = app.emit_to("launcher", "session-changed", false);
    }
    Ok(())
}
pub fn show_launcher(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("launcher") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
pub fn monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(3));
        let state = app.state::<State>();
        // Stop / force-stop commands own the session until they finish. This
        // also prevents the monitor from taking a newly replaced session.
        let Ok(_operation) = Operation::acquire(&state) else {
            continue;
        };
        let dead = {
            let mut session = state.session.lock().unwrap();
            session.as_mut().and_then(|s| {
                s.child
                    .try_wait()
                    .ok()
                    .flatten()
                    .map(|status| (status, s.stop_reason))
            })
        };
        if let Some((status, reason)) = dead.filter(|_| !state.closing.load(Ordering::SeqCst)) {
            if let Some(reason) = reason {
                let _ = complete(&app, reason);
                continue;
            }
            crate::logs::record(&app, &format!("LocalBridge 意外退出（{status}）"));
            state.session.lock().unwrap().take();
            state.exiting.store(false, Ordering::SeqCst);
            if let Some(window) = app.get_webview_window("renderer") {
                let _ = window.destroy();
            }
            show_launcher(&app);
            let _ = app.emit_to(
                "launcher",
                "session-error",
                "mpelb 意外退出，请检查日志后重试",
            );
        }
        if state.session.lock().unwrap().is_some()
            && now().saturating_sub(state.heartbeat.load(Ordering::SeqCst)) > 120
        {
            show_launcher(&app);
            let _ = app.emit_to(
                "launcher",
                "session-error",
                "编辑器长时间未响应，可在环境管理中结束服务后重试",
            );
            state.heartbeat.store(now(), Ordering::SeqCst);
        }
    });
}

pub fn aborted(app: tauri::AppHandle) {
    crate::logs::record(&app, "编辑器异常关闭，正在清理 LocalBridge");
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<State>();
        if state.closing.swap(true, Ordering::SeqCst) {
            return;
        }
        let id = state.session.lock().unwrap().as_ref().map(|s| s.id.clone());
        if let Some(id) = id {
            match stop(&app, &id, StopReason::RendererFailed) {
                Ok(()) => {
                    let _ = complete(&app, StopReason::RendererFailed);
                }
                Err(err) => {
                    let _ = app.emit_to("launcher", "session-error", err);
                }
            }
        }
        state.closing.store(false, Ordering::SeqCst);
        show_launcher(&app);
        let _ = app.emit_to(
            "launcher",
            "session-error",
            "编辑器窗口意外关闭，已请求停止服务；未保存内容可从项目缓存恢复",
        );
    });
}
