use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub name: String,
    pub path: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub projects: Vec<Project>,
    pub selected_project: String,
    pub hide_launcher: bool,
    pub exit_after_editor: bool,
    pub auto_update: bool,
    pub fixed_version: Option<String>,
    pub onboarding_done: bool,
    pub theme: String,
    pub background: bool,
    pub ambient_animations: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            projects: vec![],
            selected_project: String::new(),
            hide_launcher: true,
            exit_after_editor: true,
            auto_update: true,
            fixed_version: None,
            onboarding_done: false,
            theme: "dark".into(),
            background: false,
            ambient_animations: true,
        }
    }
}
pub fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("app data directory")
}
pub fn load(app: &tauri::AppHandle) -> Settings {
    ["settings.json", "settings.previous.json"]
        .iter()
        .find_map(|name| {
            std::fs::read(data_dir(app).join(name))
                .ok()
                .and_then(|v| serde_json::from_slice(&v).ok())
        })
        .unwrap_or_default()
}
pub fn save(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    let dir = data_dir(app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    let backup = dir.join("settings.previous.json");
    std::fs::write(
        dir.join("settings.next.json"),
        serde_json::to_vec_pretty(settings).unwrap(),
    )
    .map_err(|e| e.to_string())?;
    if path.exists() {
        std::fs::copy(&path, &backup).map_err(|e| e.to_string())?;
    }
    std::fs::rename(dir.join("settings.next.json"), &path).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn engine_dir() -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap_or_default()).join("mpelb")
    } else {
        PathBuf::from(std::env::var_os("HOME").unwrap_or_default()).join(".local/bin")
    }
}
pub fn binary_name() -> &'static str {
    if cfg!(windows) {
        "mpelb.exe"
    } else {
        "mpelb"
    }
}
pub fn platform() -> &'static str {
    if cfg!(windows) {
        "windows-amd64"
    } else {
        "darwin-arm64"
    }
}
