use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use atomicwrites::{AllowOverwrite, AtomicFile};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{PACKAGE_VERSION, PROTOCOL_VERSION};
use crate::python::PythonInterpreter;

#[derive(Debug, Clone)]
pub struct PythonEnvironment {
    pub python: PathBuf,
}

#[derive(Debug, Clone)]
pub struct EnvironmentManager {
    root: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnvironmentPointer {
    current_version: String,
    previous_version: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DoctorResult {
    ok: bool,
    package_version: String,
    protocol_version: String,
}

impl EnvironmentManager {
    pub fn new(app_data_dir: &Path) -> Self {
        Self {
            root: app_data_dir.join("python-envs"),
        }
    }

    pub fn ensure(&self, interpreter: &PythonInterpreter) -> AppResult<PythonEnvironment> {
        let environment = self.prepare(interpreter, PACKAGE_VERSION)?;
        self.switch_pointer(PACKAGE_VERSION)?;
        Ok(environment)
    }

    pub fn prepare(
        &self,
        interpreter: &PythonInterpreter,
        version: &str,
    ) -> AppResult<PythonEnvironment> {
        fs::create_dir_all(&self.root)?;
        let target = self.root.join(version);
        if target.is_dir() {
            let environment = PythonEnvironment::from_root(target.clone());
            if environment.doctor(version).is_ok() {
                return Ok(environment);
            }
            fs::rename(
                &target,
                self.root
                    .join(format!("{}.failed-{}", version, Uuid::new_v4())),
            )?;
        }

        let staging = self.root.join(format!(".staging-{}", Uuid::new_v4()));
        let result = self
            .build(interpreter, &staging, version)
            .and_then(|environment| {
                environment.doctor(version)?;
                fs::rename(&staging, &target)?;
                Ok(PythonEnvironment::from_root(target.clone()))
            });
        if result.is_err() {
            let _ = fs::remove_dir_all(staging);
        }
        result
    }

    pub fn current(&self) -> AppResult<PythonEnvironment> {
        let pointer: EnvironmentPointer =
            serde_json::from_slice(&fs::read(self.root.join("current.json"))?)?;
        let environment = PythonEnvironment::from_root(self.root.join(&pointer.current_version));
        environment.doctor(&pointer.current_version)?;
        Ok(environment)
    }

    fn build(
        &self,
        interpreter: &PythonInterpreter,
        staging: &Path,
        version: &str,
    ) -> AppResult<PythonEnvironment> {
        let mut venv = interpreter.command();
        run_checked(venv.args(["-m", "venv"]).arg(staging), "创建私有 venv")?;
        let environment = PythonEnvironment::from_root(staging.to_path_buf());
        run_checked(
            Command::new(&environment.python).args([
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-input",
                "--upgrade",
                &format!("MaaPipelineEditor-LocalBridge=={version}"),
            ]),
            "安装 LocalBridge",
        )?;
        Ok(environment)
    }

    fn switch_pointer(&self, version: &str) -> AppResult<()> {
        let pointer_path = self.root.join("current.json");
        let existing = fs::read(&pointer_path)
            .ok()
            .and_then(|value| serde_json::from_slice::<EnvironmentPointer>(&value).ok());
        let previous = match existing {
            Some(pointer) if pointer.current_version == version => pointer.previous_version,
            Some(pointer) => Some(pointer.current_version),
            None => None,
        };
        let body = serde_json::to_vec_pretty(&EnvironmentPointer {
            current_version: version.into(),
            previous_version: previous,
        })?;
        AtomicFile::new(pointer_path, AllowOverwrite)
            .write(|file| file.write_all(&body))
            .map_err(|error| AppError::Python(format!("切换环境指针失败: {error}")))
    }
}

impl PythonEnvironment {
    fn from_root(root: PathBuf) -> Self {
        #[cfg(windows)]
        let python = root.join("Scripts").join("python.exe");
        #[cfg(not(windows))]
        let python = root.join("bin").join("python");
        Self { python }
    }

    pub fn doctor(&self, expected_version: &str) -> AppResult<()> {
        let output = Command::new(&self.python)
            .args(["-m", "mpe_localbridge.cli", "doctor", "--json"])
            .output()?;
        if !output.status.success() {
            return Err(AppError::Python(format!(
                "LocalBridge doctor 失败: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }
        let result: DoctorResult = serde_json::from_slice(&output.stdout)?;
        if !result.ok
            || result.package_version != expected_version
            || result.protocol_version != PROTOCOL_VERSION
        {
            return Err(AppError::Python(format!(
                "doctor 版本拒绝: package={}, protocol={}",
                result.package_version, result.protocol_version
            )));
        }
        Ok(())
    }
}

fn run_checked(command: &mut Command, operation: &str) -> AppResult<()> {
    let output = command.output()?;
    if output.status.success() {
        return Ok(());
    }
    Err(AppError::Python(format!(
        "{}失败: {}",
        operation,
        String::from_utf8_lossy(&output.stderr).trim()
    )))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{EnvironmentManager, EnvironmentPointer};

    #[test]
    fn pointer_preserves_previous_version_across_idempotent_switch() {
        let directory = tempdir().expect("tempdir should be created");
        let manager = EnvironmentManager::new(directory.path());
        fs::create_dir_all(&manager.root).expect("environment root should be created");

        manager
            .switch_pointer("1.7.4")
            .expect("first pointer should be written");
        manager
            .switch_pointer("1.7.5")
            .expect("new pointer should be written");
        manager
            .switch_pointer("1.7.5")
            .expect("same pointer should be idempotent");

        let body =
            fs::read(manager.root.join("current.json")).expect("pointer should remain readable");
        let pointer: EnvironmentPointer =
            serde_json::from_slice(&body).expect("pointer should be valid JSON");
        assert_eq!(pointer.current_version, "1.7.5");
        assert_eq!(pointer.previous_version.as_deref(), Some("1.7.4"));
    }
}
