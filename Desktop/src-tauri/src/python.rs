use std::path::PathBuf;
use std::process::{Command, Output};

use semver::Version;
use serde::Deserialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PythonInterpreter {
    pub executable: PathBuf,
    pub prefix_args: Vec<String>,
    pub version: Version,
    pub architecture: String,
}

#[derive(Debug, Deserialize)]
struct ProbeResult {
    executable: String,
    version: String,
    architecture: String,
}

impl PythonInterpreter {
    pub fn command(&self) -> Command {
        let mut command = Command::new(&self.executable);
        command.args(&self.prefix_args);
        command
    }
}

pub fn detect_python() -> AppResult<PythonInterpreter> {
    for (program, prefix_args) in candidates() {
        let mut command = Command::new(&program);
        command.args(&prefix_args).args([
            "-I",
            "-c",
            "import json,platform,sys;print(json.dumps({'executable':sys.executable,'version':platform.python_version(),'architecture':platform.machine()}))",
        ]);
        let Ok(output) = command.output() else {
            continue;
        };
        if let Ok(interpreter) = parse_probe_output(output, prefix_args.clone()) {
            return Ok(interpreter);
        }
    }
    Err(AppError::Python(
        "未找到同架构 CPython 3.11-3.14；Desktop 不会安装或修改系统 Python".into(),
    ))
}

fn parse_probe_output(output: Output, prefix_args: Vec<String>) -> AppResult<PythonInterpreter> {
    if !output.status.success() {
        return Err(AppError::Python("Python 探测命令执行失败".into()));
    }
    let probe: ProbeResult = serde_json::from_slice(&output.stdout)?;
    let version = Version::parse(&probe.version)
        .map_err(|error| AppError::Python(format!("无法解析 Python 版本: {error}")))?;
    if version.major != 3 || !(11..=14).contains(&version.minor) {
        return Err(AppError::Python(format!(
            "Python {} 不在支持范围 3.11-3.14",
            version
        )));
    }
    if normalize_arch(&probe.architecture) != normalize_arch(std::env::consts::ARCH) {
        return Err(AppError::Python(format!(
            "Python 架构 {} 与 Desktop 架构 {} 不一致",
            probe.architecture,
            std::env::consts::ARCH
        )));
    }
    Ok(PythonInterpreter {
        executable: PathBuf::from(probe.executable),
        prefix_args,
        version,
        architecture: probe.architecture,
    })
}

fn normalize_arch(value: &str) -> String {
    match value.to_ascii_lowercase().as_str() {
        "amd64" | "x86_64" => "x86_64".into(),
        "arm64" | "aarch64" => "aarch64".into(),
        _ => value.to_ascii_lowercase(),
    }
}

fn candidates() -> Vec<(String, Vec<String>)> {
    let mut values = Vec::new();
    #[cfg(windows)]
    for minor in (11..=14).rev() {
        values.push(("py".into(), vec![format!("-3.{minor}")]));
        values.push((format!("python3.{minor}"), Vec::new()));
    }
    #[cfg(not(windows))]
    for minor in (11..=14).rev() {
        values.push((format!("python3.{minor}"), Vec::new()));
    }
    values.push(("python3".into(), Vec::new()));
    values.push(("python".into(), Vec::new()));
    values
}

#[cfg(test)]
mod tests {
    use super::normalize_arch;

    #[test]
    fn architecture_aliases_are_normalized() {
        assert_eq!(normalize_arch("AMD64"), "x86_64");
        assert_eq!(normalize_arch("arm64"), "aarch64");
    }
}
