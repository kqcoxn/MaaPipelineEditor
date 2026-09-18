use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::Manager;

#[derive(Default)]
pub struct Startup(AtomicBool);

// Both the frontend handshake and the watchdog may arrive. Reveal only once,
// so a late handshake/HMR cannot reopen a launcher hidden for an edit session.
pub fn reveal(app: &tauri::AppHandle) -> Result<(), String> {
    app.state::<Startup>().reveal_once(|| {
        app.get_webview_window("launcher")
            .ok_or_else(|| "启动器窗口不存在".to_string())
            .and_then(|window| window.show().map_err(|e| e.to_string()))
    })
}

impl Startup {
    fn reveal_once(&self, show: impl FnOnce() -> Result<(), String>) -> Result<(), String> {
        if self.0.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let result = show();
        if result.is_err() {
            self.0.store(false, Ordering::SeqCst);
        }
        result
    }
}

pub fn watch(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        // JS/module loading may fail entirely. Never leave an invisible singleton.
        std::thread::sleep(Duration::from_secs(8));
        if let Err(error) = reveal(&app) {
            eprintln!("显示启动器失败: {error}");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn late_handshake_or_watchdog_does_not_reopen_launcher() {
        let startup = Startup::default();
        startup.reveal_once(|| Ok(())).unwrap();
        startup
            .reveal_once(|| panic!("must not show the window again"))
            .unwrap();
    }

    #[test]
    fn watchdog_can_retry_a_failed_show() {
        let startup = Startup::default();
        assert!(startup.reveal_once(|| Err("show failed".into())).is_err());
        let mut shown = false;
        startup
            .reveal_once(|| {
                shown = true;
                Ok(())
            })
            .unwrap();
        assert!(shown);
    }
}
