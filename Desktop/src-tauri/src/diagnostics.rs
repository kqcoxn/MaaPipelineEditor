use crate::{engine, settings};

pub fn write_info(app: &tauri::AppHandle) -> std::io::Result<()> {
    std::fs::write(
        settings::data_dir(app).join("desktop.txt"),
        format!(
            "MPE Desktop {}\nDesktop revision: {}\nPlatform: {}\n",
            env!("CARGO_PKG_VERSION"),
            crate::desktop_release::revision(),
            std::env::consts::OS
        ),
    )
}

pub fn archive(app: &tauri::AppHandle) -> Result<tempfile::TempPath, String> {
    let binary = settings::engine_dir().join(settings::binary_name());
    let dir = settings::data_dir(app);
    let output = tempfile::NamedTempFile::new()
        .map_err(|e| e.to_string())?
        .into_temp_path();
    if !binary.exists() {
        let file = std::fs::File::create(&output).map_err(|e| e.to_string())?;
        crate::logs::archive(&dir, file)?;
        return Ok(output);
    }
    let temporary = tempfile::tempdir().map_err(|e| e.to_string())?;
    let errors = temporary.path().join("errors.txt");
    let mut child = engine::command(&binary)
        .args(["logs", "export", "--output"])
        .arg(&output)
        .arg("--desktop-log-dir")
        .arg(&dir)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::fs::File::create(&errors).map_err(|e| e.to_string())?)
        .spawn()
        .map_err(|e| format!("启动诊断打包失败：{e}"))?;
    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!(
            "诊断打包失败：{}",
            std::fs::read_to_string(&errors).unwrap_or_default()
        ));
    }
    Ok(output)
}
