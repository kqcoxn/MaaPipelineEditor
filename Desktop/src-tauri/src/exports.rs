use crate::commands::authorize;
use base64::Engine;
use std::{io::Write, path::Path};
use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

pub(crate) fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else {
        text.strip_prefix(r"\\?\").unwrap_or(&text).to_owned()
    }
}

// Write next to the destination, then atomically replace it only after a complete write.
pub(crate) fn save_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("无效保存位置")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temporary.write_all(bytes).map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn save_zip(
    app: &tauri::AppHandle,
    name: &str,
    bytes: &[u8],
) -> Result<Option<String>, String> {
    let name = name.replace(['/', '\\', ':'], "_");
    let name = if name.to_lowercase().ends_with(".zip") {
        name
    } else {
        format!("{name}.zip")
    };
    let Some(file) = app
        .dialog()
        .file()
        .set_title("保存日志压缩包")
        .set_file_name(name)
        .add_filter("ZIP 压缩包", &["zip"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = file.into_path().map_err(|e| e.to_string())?;
    save_bytes(&path, bytes)?;
    Ok(Some(display_path(&path)))
}

fn decode_archive(content: &str) -> Result<Vec<u8>, String> {
    if content.len() > 180 * 1024 * 1024 {
        return Err("日志包过大，请减少日志后重试（最大 128 MB）".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content)
        .map_err(|_| "日志包数据无效")?;
    if bytes.len() > 128 * 1024 * 1024
        || !(bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(b"PK\x05\x06"))
    {
        return Err("日志包不是有效的 ZIP 数据或超过 128 MB".into());
    }
    zip::ZipArchive::new(std::io::Cursor::new(&bytes)).map_err(|_| "日志包 ZIP 结构无效")?;
    Ok(bytes)
}

#[tauri::command]
pub async fn desktop_save_archive(
    window: WebviewWindow,
    app: tauri::AppHandle,
    name: String,
    content: String,
) -> Result<Option<String>, String> {
    authorize(&window, "renderer")?;
    tauri::async_runtime::spawn_blocking(move || save_zip(&app, &name, &decode_archive(&content)?))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_archive_data() {
        assert!(decode_archive("invalid").is_err());
        assert!(decode_archive("aGVsbG8=").is_err());
        assert!(decode_archive("UEsFBg==").is_err());
        let bytes = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()))
            .finish()
            .unwrap()
            .into_inner();
        assert_eq!(
            decode_archive(&base64::engine::general_purpose::STANDARD.encode(&bytes)).unwrap(),
            bytes
        );
    }
    #[test]
    fn saves_complete_content_and_replaces_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("logs.zip");
        save_bytes(&path, b"old").unwrap();
        save_bytes(&path, b"new complete archive").unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"new complete archive");
        assert!(save_bytes(&dir.path().join("missing/logs.zip"), b"x").is_err());
    }
}
