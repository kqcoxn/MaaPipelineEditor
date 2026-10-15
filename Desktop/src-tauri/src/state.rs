use crate::settings::Settings;
use std::{
    process::Child,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
pub struct Session {
    pub address: String,
    pub child: Child,
    pub id: String,
    pub root: String,
    pub stop_reason: Option<StopReason>,
    #[cfg(windows)]
    pub _job: crate::windows_job::Job,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StopReason {
    EditorClosed,
    RendererFailed,
    Forced,
}
impl Session {
    pub fn exit_error(&self, status: std::process::ExitStatus) -> Option<String> {
        match self.stop_reason {
            Some(StopReason::Forced) => None,
            Some(_) if status.success() => None,
            Some(_) => Some(format!(
                "LocalBridge 在停止期间异常退出（{status}），请查看日志"
            )),
            None => Some(format!("LocalBridge 意外退出（{status}），请查看日志")),
        }
    }
}
pub struct InstanceLock(pub std::fs::File);
pub struct State {
    pub settings: Mutex<Settings>,
    pub session: Mutex<Option<Session>>,
    pub busy: AtomicBool,
    pub update_cancel: Mutex<Option<Arc<crate::update_cancel::Cancellation>>>,
    pub closing: AtomicBool,
    pub exiting: AtomicBool,
    pub heartbeat: AtomicU64,
}
impl State {
    pub fn new(settings: Settings) -> Self {
        Self {
            settings: Mutex::new(settings),
            session: Mutex::new(None),
            busy: AtomicBool::new(false),
            update_cancel: Mutex::new(None),
            closing: AtomicBool::new(false),
            exiting: AtomicBool::new(false),
            heartbeat: AtomicU64::new(0),
        }
    }
}
pub struct Operation<'a>(&'a AtomicBool);
impl<'a> Operation<'a> {
    pub fn acquire(state: &'a State) -> Result<Self, String> {
        if state
            .busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err("另一个操作正在进行".into());
        }
        Ok(Self(&state.busy))
    }
}
impl Drop for Operation<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst)
    }
}
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
#[path = "session_shutdown_tests.rs"]
mod shutdown_tests;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn operations_are_exclusive_and_release_after_error() {
        let state = State::new(Settings::default());
        {
            let _operation = Operation::acquire(&state).unwrap();
            assert!(Operation::acquire(&state).is_err());
        }
        assert!(Operation::acquire(&state).is_ok());
    }
}
