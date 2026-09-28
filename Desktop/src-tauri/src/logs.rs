use crate::{commands::authorize, exports, settings::data_dir, state::now};
use serde::Serialize;
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::WebviewWindow;
use tauri_plugin_opener::OpenerExt;

const SOURCES: &[(&str, &str)] = &[
    ("launcher.log", "启动器"),
    ("launcher.previous.log", "启动器 · 历史"),
    ("mpelb.log", "LocalBridge · 当前会话"),
    ("mpelb.previous.log", "LocalBridge · 上次会话"),
];
const PREVIEW_LIMIT: u64 = 512 * 1024;
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn record(app: &tauri::AppHandle, message: &str) {
    let Ok(_lock) = WRITE_LOCK.lock() else {
        return;
    };
    let dir = data_dir(app);
    let path = dir.join("launcher.log");
    if fs::metadata(&path).is_ok_and(|m| m.len() > 4 * 1024 * 1024) {
        let _ = fs::copy(&path, dir.join("launcher.previous.log"));
        let _ = fs::write(&path, []);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{}] {}", now(), message);
    }
}

fn resolve(dir: &Path, id: &str) -> Result<PathBuf, String> {
    if !SOURCES.iter().any(|(name, _)| *name == id) {
        return Err("未知日志".into());
    }
    let path = dir.join(id).canonicalize().map_err(|e| e.to_string())?;
    if path.parent() != Some(dir.canonicalize().map_err(|e| e.to_string())?.as_path())
        || !path.is_file()
    {
        return Err("日志路径无效".into());
    }
    Ok(path)
}

#[derive(Serialize)]
pub struct LogFile {
    id: String,
    name: String,
    size: u64,
}
#[derive(Serialize)]
pub struct LogContent {
    content: String,
    truncated: bool,
    path: String,
}

#[tauri::command]
pub async fn list_logs(
    window: WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Vec<LogFile>, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || {
        let dir = data_dir(&app);
        SOURCES
            .iter()
            .filter_map(|(id, name)| {
                let path = resolve(&dir, id).ok()?;
                let meta = fs::metadata(path).ok()?;
                Some(LogFile {
                    id: id.to_string(),
                    name: name.to_string(),
                    size: meta.len(),
                })
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

fn tail(path: &Path) -> Result<LogContent, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let size = file.metadata().map_err(|e| e.to_string())?.len();
    let truncated = size > PREVIEW_LIMIT;
    file.seek(SeekFrom::Start(size.saturating_sub(PREVIEW_LIMIT)))
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(PREVIEW_LIMIT)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if truncated {
        if let Some(newline) = bytes.iter().position(|b| *b == b'\n') {
            bytes.drain(..=newline);
        }
    }
    Ok(LogContent {
        content: crate::log_text::plain_text(&String::from_utf8_lossy(&bytes)),
        truncated,
        path: exports::display_path(path),
    })
}

#[tauri::command]
pub async fn read_log(
    window: WebviewWindow,
    app: tauri::AppHandle,
    id: String,
) -> Result<LogContent, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || tail(&resolve(&data_dir(&app), &id)?))
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn archive<W: Write + Seek>(dir: &Path, destination: W) -> Result<W, String> {
    let mut zip = zip::ZipWriter::new(destination);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (id, _) in SOURCES {
        if !dir.join(id).exists() {
            continue;
        }
        let mut file = File::open(resolve(dir, id)?).map_err(|e| e.to_string())?;
        let size = file.metadata().map_err(|e| e.to_string())?.len();
        zip.start_file(
            format!("desktop/{id}"),
            options.large_file(size >= u32::MAX as u64),
        )
        .map_err(|e| e.to_string())?;
        // Fixed length snapshot: a running service may continue writing during export.
        std::io::copy(&mut Read::by_ref(&mut file).take(size), &mut zip)
            .map_err(|e| e.to_string())?;
    }
    zip.start_file("desktop/desktop.txt", options)
        .map_err(|e| e.to_string())?;
    write!(zip, "MPE Desktop {}\nDesktop revision: {}\nPlatform: {}\nExported at (Unix seconds): {}\nLocalBridge is not installed; backend and frontend diagnostics are unavailable.\n", env!("CARGO_PKG_VERSION"), crate::desktop_release::revision(), std::env::consts::OS, now()).map_err(|e| e.to_string())?;
    zip.start_file("manifest.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(br#"{"warnings":["LocalBridge is not installed; backend and frontend diagnostics are unavailable."]}"#).map_err(|e| e.to_string())?;
    zip.finish().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_logs(
    window: WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    authorize(&window, "launcher")?;
    tauri::async_runtime::spawn_blocking(move || {
        let archive = crate::diagnostics::archive(&app)?;
        exports::save_zip(&app, &format!("mpe-desktop-logs-{}.zip", now()), || {
            Ok(Box::new(File::open(&archive).map_err(|e| e.to_string())?))
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_logs_directory(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    authorize(&window, "launcher")?;
    app.opener()
        .open_path(data_dir(&app).to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn archived(dir: &Path) -> std::io::Cursor<Vec<u8>> {
        archive(dir, std::io::Cursor::new(Vec::new())).unwrap()
    }
    #[test]
    fn only_exports_known_logs_and_keeps_full_content() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("launcher.log"), "日志内容\n").unwrap();
        fs::write(dir.path().join("settings.json"), "secret").unwrap();
        assert!(resolve(dir.path(), "../launcher.log").is_err());
        assert!(resolve(dir.path(), "settings.json").is_err());
        let mut zip = zip::ZipArchive::new(archived(dir.path())).unwrap();
        assert!(zip.by_name("desktop/settings.json").is_err());
        let mut manifest = String::new();
        zip.by_name("manifest.json")
            .unwrap()
            .read_to_string(&mut manifest)
            .unwrap();
        let manifest: serde_json::Value = serde_json::from_str(&manifest).unwrap();
        assert!(manifest["warnings"][0]
            .as_str()
            .unwrap()
            .contains("LocalBridge is not installed"));
        let mut content = String::new();
        zip.by_name("desktop/launcher.log")
            .unwrap()
            .read_to_string(&mut content)
            .unwrap();
        assert_eq!(content, "日志内容\n");
    }
    #[test]
    fn preview_is_bounded_but_archive_is_complete() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mpelb.log");
        let text = "一行日志\n".repeat(60000);
        fs::write(&path, &text).unwrap();
        let preview = tail(&path).unwrap();
        assert!(preview.truncated);
        assert!(preview.content.len() <= PREVIEW_LIMIT as usize);
        assert!(preview.content.ends_with("一行日志\n"));
        let mut zip = zip::ZipArchive::new(archived(dir.path())).unwrap();
        assert_eq!(
            zip.by_name("desktop/mpelb.log").unwrap().size(),
            text.len() as u64
        );
    }

    #[test]
    fn exports_large_desktop_log_to_disk_completely() {
        let dir = tempfile::tempdir().unwrap();
        let mut file = File::create(dir.path().join("launcher.log")).unwrap();
        const SIZE: u64 = 128 * 1024 * 1024;
        file.set_len(SIZE).unwrap();
        file.seek(SeekFrom::End(0)).unwrap();
        file.write_all(b"tail").unwrap();
        drop(file);
        let output = archive(dir.path(), tempfile::tempfile().unwrap()).unwrap();
        let mut zip = zip::ZipArchive::new(output).unwrap();
        let mut entry = zip.by_name("desktop/launcher.log").unwrap();
        assert_eq!(entry.size(), SIZE + 4);
        std::io::copy(
            &mut Read::by_ref(&mut entry).take(SIZE),
            &mut std::io::sink(),
        )
        .unwrap();
        let mut tail = String::new();
        entry.read_to_string(&mut tail).unwrap();
        assert_eq!(tail, "tail");
    }
}
