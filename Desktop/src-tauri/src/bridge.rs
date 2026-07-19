use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::environment::{EnvironmentManager, PythonEnvironment};
use crate::error::{AppError, AppResult};
use crate::models::{
    BridgePhase, BridgeStatus, LocalBridgeBootstrap, PACKAGE_VERSION, PROTOCOL_VERSION,
};
use crate::process_group::{self, ProcessGroup};
use crate::python::detect_python;

const READY_TIMEOUT: Duration = Duration::from_secs(30);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_RESTARTS: u8 = 3;

pub struct BridgeSupervisor {
    environment: EnvironmentManager,
    config_path: PathBuf,
    log_path: PathBuf,
    workspace: Mutex<Option<PathBuf>>,
    inner: Mutex<RuntimeState>,
    changed: Condvar,
    shutting_down: AtomicBool,
}

struct RuntimeState {
    status: BridgeStatus,
    child: Option<ManagedChild>,
    ready_since: Option<Instant>,
}

struct ManagedChild {
    child: Child,
    stdin: ChildStdin,
    group: ProcessGroup,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyMessage {
    #[serde(rename = "type")]
    message_type: String,
    port: u16,
    protocol_version: String,
    package_version: String,
}

impl BridgeSupervisor {
    pub fn new(app_data_dir: &Path, workspace: Option<PathBuf>) -> AppResult<Arc<Self>> {
        let log_dir = app_data_dir.join("logs");
        fs::create_dir_all(&log_dir)?;
        Ok(Arc::new(Self {
            environment: EnvironmentManager::new(app_data_dir),
            config_path: app_data_dir.join("localbridge-config.json"),
            log_path: log_dir.join("localbridge-stderr.log"),
            workspace: Mutex::new(workspace),
            inner: Mutex::new(RuntimeState {
                status: BridgeStatus {
                    phase: BridgePhase::PreparingEnvironment,
                    message: "正在准备 Python 环境".into(),
                    restart_attempt: 0,
                    bootstrap: None,
                },
                child: None,
                ready_since: None,
            }),
            changed: Condvar::new(),
            shutting_down: AtomicBool::new(false),
        }))
    }

    pub fn initialize(self: &Arc<Self>) {
        let supervisor = Arc::clone(self);
        thread::spawn(move || {
            if let Err(error) = supervisor.prepare_and_launch() {
                supervisor.set_repair_required(error.to_string());
            }
        });
        let supervisor = Arc::clone(self);
        thread::spawn(move || supervisor.monitor());
    }

    pub fn status(&self) -> BridgeStatus {
        self.lock_inner().status.clone()
    }

    pub fn bootstrap(&self, timeout: Duration) -> AppResult<LocalBridgeBootstrap> {
        let deadline = Instant::now() + timeout;
        let mut inner = self.lock_inner();
        loop {
            if let Some(bootstrap) = &inner.status.bootstrap {
                return Ok(bootstrap.clone());
            }
            if inner.status.phase == BridgePhase::RepairRequired {
                return Err(AppError::Bridge(inner.status.message.clone()));
            }
            let now = Instant::now();
            if now >= deadline {
                return Err(AppError::Timeout("等待 LocalBridge ready".into()));
            }
            let (next, result) = self
                .changed
                .wait_timeout(inner, deadline - now)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            inner = next;
            if result.timed_out() {
                return Err(AppError::Timeout("等待 LocalBridge ready".into()));
            }
        }
    }

    pub fn workspace(&self) -> Option<PathBuf> {
        self.workspace
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    pub fn set_workspace(&self, workspace: Option<PathBuf>) -> AppResult<()> {
        *self
            .workspace
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = workspace;
        self.restart()
    }

    pub fn restart(&self) -> AppResult<()> {
        self.stop_child(false)?;
        {
            let mut inner = self.lock_inner();
            inner.status.restart_attempt = 0;
            inner.status.phase = BridgePhase::Starting;
            inner.status.message = "正在手动重启 LocalBridge".into();
            self.changed.notify_all();
        }
        let environment = self.environment.current()?;
        self.launch(&environment)
    }

    pub fn repair(&self) -> AppResult<()> {
        self.shutting_down.store(false, Ordering::SeqCst);
        self.stop_child(false)?;
        {
            let mut inner = self.lock_inner();
            inner.status.restart_attempt = 0;
        }
        self.prepare_and_launch()
    }

    pub fn shutdown(&self) -> AppResult<()> {
        self.shutting_down.store(true, Ordering::SeqCst);
        self.stop_child(true)
    }

    pub fn prepare_version(&self, version: &str) -> AppResult<()> {
        let interpreter = detect_python()?;
        self.environment.prepare(&interpreter, version)?;
        Ok(())
    }

    fn prepare_and_launch(&self) -> AppResult<()> {
        self.set_phase(
            BridgePhase::PreparingEnvironment,
            "正在探测 CPython 3.11-3.14",
        );
        let interpreter = detect_python()?;
        self.set_phase(
            BridgePhase::PreparingEnvironment,
            &format!("正在验证 Python {} 私有环境", interpreter.version),
        );
        let environment = self.environment.ensure(&interpreter)?;
        self.launch(&environment)
    }

    fn launch(&self, environment: &PythonEnvironment) -> AppResult<()> {
        self.set_phase(BridgePhase::Starting, "正在启动 LocalBridge");
        let mut command = Command::new(&environment.python);
        command.args([
            "-m",
            "mpe_localbridge.cli",
            "serve",
            "--host",
            "127.0.0.1",
            "--port",
            "0",
            "--control-stdio",
            "--no-open",
            "--config",
        ]);
        command.arg(&self.config_path);
        if let Some(workspace) = self
            .workspace
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
        {
            command.arg("--root").arg(workspace);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        process_group::configure(&mut command);
        let mut child = command.spawn()?;
        let group = process_group::attach(&child)?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::Bridge("无法打开 LocalBridge stdin".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::Bridge("无法打开 LocalBridge stdout".into()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| AppError::Bridge("无法打开 LocalBridge stderr".into()))?;

        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let mut ready_sent = false;
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let Ok(message) = serde_json::from_str::<ReadyMessage>(&line) else {
                    continue;
                };
                if message.message_type == "ready" && !ready_sent {
                    let _ = ready_tx.send(message);
                    ready_sent = true;
                }
            }
        });
        self.pipe_stderr(stderr);

        let ready = match ready_rx.recv_timeout(READY_TIMEOUT) {
            Ok(ready) => ready,
            Err(_) => {
                group.kill();
                let _ = child.wait();
                return Err(AppError::Timeout(
                    "LocalBridge 未在 30 秒内报告 ready".into(),
                ));
            }
        };
        let bootstrap = match bootstrap_from_ready(ready) {
            Ok(bootstrap) => bootstrap,
            Err(error) => {
                group.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let mut inner = self.lock_inner();
        inner.child = Some(ManagedChild {
            child,
            stdin,
            group,
        });
        inner.ready_since = Some(Instant::now());
        inner.status.phase = BridgePhase::Ready;
        inner.status.message = "LocalBridge 已就绪".into();
        inner.status.bootstrap = Some(bootstrap);
        self.changed.notify_all();
        Ok(())
    }

    fn monitor(self: Arc<Self>) {
        while !self.shutting_down.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(500));
            let crashed = {
                let mut inner = self.lock_inner();
                let Some(child) = inner.child.as_mut() else {
                    continue;
                };
                match child.child.try_wait() {
                    Ok(Some(status)) => Some(status.to_string()),
                    Ok(None) => None,
                    Err(error) => Some(error.to_string()),
                }
            };
            let Some(reason) = crashed else {
                continue;
            };
            if self.shutting_down.load(Ordering::SeqCst) {
                break;
            }
            let attempt = {
                let mut inner = self.lock_inner();
                inner.child.take();
                inner.status.bootstrap = None;
                if inner
                    .ready_since
                    .is_some_and(|started| started.elapsed() >= Duration::from_secs(60))
                {
                    inner.status.restart_attempt = 0;
                }
                inner.status.restart_attempt += 1;
                let attempt = inner.status.restart_attempt;
                if attempt > MAX_RESTARTS {
                    inner.status.restart_attempt = MAX_RESTARTS;
                    inner.status.phase = BridgePhase::RepairRequired;
                    inner.status.message =
                        format!("LocalBridge 连续重启失败 {} 次: {reason}", MAX_RESTARTS);
                } else {
                    inner.status.phase = BridgePhase::Restarting;
                    inner.status.message =
                        format!("LocalBridge 异常退出，准备第 {attempt} 次重启: {reason}");
                }
                self.changed.notify_all();
                attempt
            };
            if attempt > MAX_RESTARTS {
                continue;
            }
            thread::sleep(Duration::from_secs(1_u64 << (attempt - 1)));
            let result = self
                .environment
                .current()
                .and_then(|environment| self.launch(&environment));
            if let Err(error) = result {
                self.set_repair_required(error.to_string());
            }
        }
    }

    fn stop_child(&self, final_shutdown: bool) -> AppResult<()> {
        let child = self.lock_inner().child.take();
        let Some(mut child) = child else {
            if final_shutdown {
                self.set_phase(BridgePhase::Stopped, "LocalBridge 已停止");
            }
            return Ok(());
        };
        let payload = json!({"id": Uuid::new_v4(), "command": "shutdown"});
        let _ = writeln!(child.stdin, "{payload}");
        let _ = child.stdin.flush();
        let deadline = Instant::now() + SHUTDOWN_TIMEOUT;
        while Instant::now() < deadline {
            if child.child.try_wait()?.is_some() {
                if final_shutdown {
                    self.set_phase(BridgePhase::Stopped, "LocalBridge 已停止");
                }
                return Ok(());
            }
            thread::sleep(Duration::from_millis(50));
        }
        child.group.terminate();
        thread::sleep(Duration::from_millis(250));
        if child.child.try_wait()?.is_none() {
            child.group.kill();
        }
        let _ = child.child.wait();
        if final_shutdown {
            self.set_phase(BridgePhase::Stopped, "LocalBridge 已强制停止");
        }
        Ok(())
    }

    fn pipe_stderr(&self, stderr: impl std::io::Read + Send + 'static) {
        let path = self.log_path.clone();
        thread::spawn(move || {
            let Ok(mut output) = OpenOptions::new().create(true).append(true).open(path) else {
                return;
            };
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let _ = writeln!(output, "{line}");
            }
        });
    }

    fn set_phase(&self, phase: BridgePhase, message: &str) {
        let mut inner = self.lock_inner();
        inner.status.phase = phase;
        inner.status.message = message.into();
        if inner.status.phase != BridgePhase::Ready {
            inner.status.bootstrap = None;
        }
        self.changed.notify_all();
    }

    fn set_repair_required(&self, message: String) {
        let mut inner = self.lock_inner();
        inner.status.phase = BridgePhase::RepairRequired;
        inner.status.message = message;
        inner.status.bootstrap = None;
        self.changed.notify_all();
    }

    fn lock_inner(&self) -> MutexGuard<'_, RuntimeState> {
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn bootstrap_from_ready(ready: ReadyMessage) -> AppResult<LocalBridgeBootstrap> {
    if ready.message_type != "ready" {
        return Err(AppError::Bridge("LocalBridge 控制消息不是 ready".into()));
    }
    if ready.port == 0 {
        return Err(AppError::Bridge(
            "LocalBridge ready 消息缺少有效端口".into(),
        ));
    }
    if ready.protocol_version != PROTOCOL_VERSION || ready.package_version != PACKAGE_VERSION {
        return Err(AppError::Bridge(format!(
            "LocalBridge 版本拒绝: package={}, protocol={}",
            ready.package_version, ready.protocol_version
        )));
    }
    Ok(LocalBridgeBootstrap {
        port: ready.port,
        protocol_version: ready.protocol_version,
        package_version: ready.package_version,
    })
}

impl Drop for BridgeSupervisor {
    fn drop(&mut self) {
        self.shutting_down.store(true, Ordering::SeqCst);
        let _ = self.stop_child(true);
    }
}

#[cfg(test)]
mod tests {
    use super::{bootstrap_from_ready, ReadyMessage};
    use crate::models::{PACKAGE_VERSION, PROTOCOL_VERSION};

    fn valid_ready() -> ReadyMessage {
        ReadyMessage {
            message_type: "ready".into(),
            port: 32100,
            protocol_version: PROTOCOL_VERSION.into(),
            package_version: PACKAGE_VERSION.into(),
        }
    }

    #[test]
    fn ready_message_is_converted_to_bootstrap() {
        let bootstrap = bootstrap_from_ready(valid_ready()).expect("ready should be valid");

        assert_eq!(bootstrap.port, 32100);
        assert_eq!(bootstrap.protocol_version, PROTOCOL_VERSION);
        assert_eq!(bootstrap.package_version, PACKAGE_VERSION);
    }

    #[test]
    fn mismatched_ready_version_is_rejected() {
        let mut ready = valid_ready();
        ready.package_version = "0.0.0".into();

        let error = bootstrap_from_ready(ready).expect_err("version must be rejected");

        assert!(error.to_string().contains("版本拒绝"));
    }
}
