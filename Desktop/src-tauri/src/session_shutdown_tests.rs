use super::{Session, StopReason};
use std::{io::Read, process::Stdio, time::Duration};

// Only launch this test binary. Closing its input releases the simulated
// in-flight controller operation, without touching a real LB or emulator.
#[test]
fn child() {
    if let Ok(code) = std::env::var("MPE_SHUTDOWN_TEST_EXIT") {
        std::io::stdin().read_to_end(&mut Vec::new()).unwrap();
        std::process::exit(code.parse().unwrap());
    }
}

struct TestSession(Session);
impl TestSession {
    fn new(code: i32, reason: Option<StopReason>) -> Self {
        let child = crate::engine::command(&std::env::current_exe().unwrap())
            .args(["--exact", "state::shutdown_tests::child"])
            .env("MPE_SHUTDOWN_TEST_EXIT", code.to_string())
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        #[cfg(windows)]
        let job = crate::windows_job::Job::attach(&child).unwrap();
        Self(Session {
            address: String::new(),
            id: "abcd".into(),
            root: String::new(),
            child,
            stop_reason: reason,
            #[cfg(windows)]
            _job: job,
        })
    }

    fn finish(&mut self) -> std::process::ExitStatus {
        drop(self.0.child.stdin.take());
        crate::engine::wait_for_stop(Duration::from_secs(10), false, || {
            self.0.child.try_wait().unwrap().is_some()
        })
        .unwrap();
        self.0.child.wait().unwrap()
    }
}
impl Drop for TestSession {
    fn drop(&mut self) {
        let _ = self.0.child.kill();
        let _ = self.0.child.wait();
    }
}

#[test]
fn graceful_exit_after_timeout_keeps_stop_intent() {
    let mut session = TestSession::new(0, Some(StopReason::EditorClosed));
    let result = crate::engine::wait_for_stop(Duration::from_millis(20), false, || {
        session.0.child.try_wait().unwrap().is_some()
    });
    assert!(result.unwrap_err().contains("仍在清理"));
    assert_eq!(session.0.stop_reason, Some(StopReason::EditorClosed));
    assert!(session.0.child.try_wait().unwrap().is_none());
    let status = session.finish();
    assert!(status.success());
    assert_eq!(session.0.exit_error(status), None);
}

#[test]
fn stop_intent_does_not_hide_crashes_or_unrequested_exits() {
    for (reason, code, expected_error) in [
        (Some(StopReason::EditorClosed), 7, Some("停止期间异常退出")),
        (Some(StopReason::RendererFailed), 0, None),
        (Some(StopReason::Forced), 7, None),
        (None, 0, Some("意外退出")),
    ] {
        let mut session = TestSession::new(code, reason);
        let status = session.finish();
        assert_eq!(status.code(), Some(code));
        let error = session.0.exit_error(status);
        match expected_error {
            Some(message) => assert!(error.unwrap().contains(message)),
            None => assert_eq!(error, None),
        }
    }
}
