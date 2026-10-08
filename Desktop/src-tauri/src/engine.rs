use crate::settings::{binary_name, data_dir, engine_dir, platform};
use serde_json::{json, Value};
use std::{
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};
use tauri::Emitter;
mod download;
mod install;
pub use install::install;

pub const RELEASES: &str = "https://github.com/kqcoxn/MaaPipelineEditor/releases";
pub fn command(path: &Path) -> Command {
    let mut command = Command::new(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
}
pub fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .user_agent("MPE-Desktop")
        .timeout(Duration::from_secs(1800))
        .build()
        .map_err(|e| e.to_string())
}
pub fn manifest(app: &tauri::AppHandle, version: &str) -> Result<Value, String> {
    if !version
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
    {
        return Err("无效版本".into());
    }
    let address = if version == "latest" {
        format!("{RELEASES}/latest/download/mpe-manifest.json")
    } else {
        format!("{RELEASES}/download/v{version}/mpe-manifest.json")
    };
    let value = download::manifest(&client()?, &address, |message| {
        crate::logs::record(app, message);
        let _ = app.emit_to("launcher", "engine-progress", message);
    })?;
    validate_manifest(&value, version)?;
    Ok(value)
}
pub(crate) fn validate_manifest(value: &Value, version: &str) -> Result<(), String> {
    if value["managementProtocol"] != 1 || value["platforms"][platform()].is_null() {
        return Err("该版本不提供当前平台的配套环境".into());
    }
    let release = value["version"].as_str().ok_or("清单缺少版本号")?;
    semver::Version::parse(release).map_err(|_| "清单版本号无效")?;
    for artifact in [
        &value["platforms"][platform()]["binary"],
        &value["platforms"][platform()]["bundle"],
        &value["editor"],
    ] {
        if !artifact["url"]
            .as_str()
            .is_some_and(|url| url.starts_with("https://"))
            || !artifact["sha256"]
                .as_str()
                .is_some_and(|hash| hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()))
        {
            return Err("配套清单缺少完整下载资源或校验值".into());
        }
    }
    crate::desktop_release::require_supported(value)?;
    if version != "latest" && value["version"] != version {
        return Err("清单版本不符".into());
    }
    Ok(())
}
pub fn json_command(binary: &Path, args: &[&str]) -> Result<Value, String> {
    let out = command(binary)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().into());
    }
    serde_json::from_slice(&out.stdout).map_err(|e| format!("管理接口返回无效数据: {e}"))
}
pub fn check() -> Result<Value, String> {
    let dir = engine_dir();
    let binary = dir.join(binary_name());
    if !binary.exists() {
        return Ok(
            json!({"ready":false,"version":"","directory":dir,"problems":["尚未安装 MPE 环境"]}),
        );
    }
    json_command(&binary,&["env","check","--with-editor","--json"]).map(crate::desktop_release::check_environment).or_else(|_| Ok(json!({"ready":false,"version":"","directory":dir,"problems":["现有 mpelb 尚未提供完整环境管理能力，请安装配套环境"]})))
}
fn control(method: &str, route: &str) -> Result<Value, String> {
    use fs2::FileExt;
    let base = if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA").unwrap_or_default())
    } else {
        PathBuf::from(std::env::var_os("HOME").unwrap_or_default())
            .join("Library/Application Support")
    };
    let dir = base.join("MaaPipelineEditor/management");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let lock = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("service.lock"))
        .map_err(|e| e.to_string())?;
    if lock.try_lock_exclusive().is_ok() {
        return Ok(json!({"state":"stopped"}));
    }
    let discovery: Value = serde_json::from_slice(
        &std::fs::read(dir.join("service.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let endpoint = discovery["endpoint"]
        .as_str()
        .filter(|s| s.starts_with("http://127.0.0.1:"))
        .ok_or("无效的本地控制地址")?;
    let client = reqwest::blocking::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    let request = if method == "POST" {
        client.post(format!("{endpoint}{route}"))
    } else {
        client.get(format!("{endpoint}{route}"))
    };
    let response = request
        .bearer_auth(discovery["token"].as_str().ok_or("无效实例凭据")?)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?;
    if route.starts_with("/force") {
        Ok(json!({"stopping":true}))
    } else {
        response.json().map_err(|e| e.to_string())
    }
}
pub fn status() -> Result<Value, String> {
    control("GET", "/status")
}
pub fn stop(id: &str, force: bool) -> Result<(), String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("实例身份无效".into());
    }
    control(
        "POST",
        &format!("/{}?id={id}", if force { "force" } else { "stop" }),
    )?;
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    while std::time::Instant::now() < deadline {
        if status().is_ok_and(|s| s["state"] == "stopped") {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Err("正常停止超时，可选择强制结束".into())
}
pub fn recover(app: &tauri::AppHandle) -> Result<(), String> {
    let binary = [
        engine_dir().join(binary_name()),
        engine_dir()
            .join(".mpe-transaction/backup")
            .join(binary_name()),
        engine_dir()
            .join(".mpe-transaction/stage")
            .join(binary_name()),
    ]
    .into_iter()
    .find(|p| p.exists())
    .ok_or("缺少安装工具，请重新安装以恢复")?;
    let dir = data_dir(app).join("recovery");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let worker = dir.join(binary_name());
    std::fs::copy(binary, &worker).map_err(|e| e.to_string())?;
    let result = command(&worker)
        .args(["env", "recover", "--json"])
        .output()
        .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(worker);
    if result.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&result.stderr).into())
    }
}
pub fn log_path(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("mpelb.log")
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Value {
        let artifact = json!({"url":"https://example.com/artifact", "sha256":"a".repeat(64)});
        json!({"version":"1.10.1", "minimumDesktopRevision":1, "managementProtocol":1, "editor":artifact, "platforms":{platform():{"binary":artifact, "bundle":artifact}}})
    }
    #[test]
    fn requires_complete_compatible_release() {
        let mut value = fixture();
        assert!(validate_manifest(&value, "1.10.1").is_ok());
        assert!(validate_manifest(&value, "1.10.2").is_err());
        value["editor"] = Value::Null;
        assert!(validate_manifest(&value, "latest").is_err());
        value = fixture();
        value["minimumDesktopRevision"] = (crate::desktop_release::legacy_revision() + 1).into();
        assert!(validate_manifest(&value, "latest").is_err());
        value["minimumDesktopRevision"] = 1.into();
        value["platforms"][platform()]["bundle"] = Value::Null;
        assert!(validate_manifest(&value, "latest").is_err());
    }
}
