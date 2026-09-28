use crate::{commands::authorize, state::State};
use std::{io::Read, path::Path};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

pub(crate) fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else {
        text.strip_prefix(r"\\?\").unwrap_or(&text).to_owned()
    }
}

// Stream to a sibling temporary file, validate the ZIP, then replace atomically.
fn save_archive(path: &Path, source: &mut impl Read) -> Result<(), String> {
    let parent = path.parent().ok_or("无效保存位置")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    std::io::copy(source, &mut temporary).map_err(|e| e.to_string())?;
    zip::ZipArchive::new(temporary.as_file()).map_err(|_| "日志包 ZIP 结构无效")?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn save_zip(
    app: &tauri::AppHandle,
    name: &str,
    source: impl FnOnce() -> Result<Box<dyn Read>, String>,
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
    save_archive(&path, &mut source()?)?;
    Ok(Some(display_path(&path)))
}

fn download_url(address: &str, path: &str) -> Result<reqwest::Url, String> {
    let token = path
        .strip_prefix("/diagnostics/")
        .ok_or("无效的日志下载地址")?;
    if token.is_empty() || !token.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return Err("无效的日志下载地址".into());
    }
    let mut url = reqwest::Url::parse(address).map_err(|e| e.to_string())?;
    url.set_scheme("http").map_err(|_| "无效的本地服务地址")?;
    url.set_path(path);
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

#[tauri::command]
pub async fn desktop_save_archive(
    window: WebviewWindow,
    app: tauri::AppHandle,
    name: String,
    download_path: String,
) -> Result<Option<String>, String> {
    authorize(&window, "renderer")?;
    let address = app
        .state::<State>()
        .session
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("编辑器会话已结束")?
        .address
        .clone();
    let url = download_url(&address, &download_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(None)
            .build()
            .map_err(|e| e.to_string())?;
        let result = save_zip(&app, &name, || {
            let response = client.get(url.clone()).send().map_err(|e| e.to_string())?;
            if !response.status().is_success() {
                return Err("日志下载失败，请重新导出".into());
            }
            Ok(Box::new(response))
        });
        // A cancelled dialog has not consumed the ticket; release its disk space.
        if !matches!(&result, Ok(Some(_))) {
            let _ = client
                .delete(url)
                .timeout(std::time::Duration::from_secs(5))
                .send();
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};

    fn archive(text: &[u8]) -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        zip.start_file("log.txt", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(text).unwrap();
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn validates_download_ticket_without_allowing_arbitrary_paths() {
        assert_eq!(
            download_url("ws://127.0.0.1:1234", "/diagnostics/ABC123")
                .unwrap()
                .as_str(),
            "http://127.0.0.1:1234/diagnostics/ABC123"
        );
        for path in [
            "/diagnostics/",
            "/diagnostics/../secret",
            "http://example.com",
            "/diagnostics/a?b",
        ] {
            assert!(download_url("ws://127.0.0.1:1234", path).is_err());
        }
    }

    #[test]
    fn saves_complete_archive_and_preserves_destination_on_failure() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("logs.zip");
        let old = archive(b"old");
        let new = archive(b"new complete archive");
        save_archive(&path, &mut old.as_slice()).unwrap();
        save_archive(&path, &mut new.as_slice()).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), new);
        assert!(save_archive(&path, &mut &b"invalid ZIP"[..]).is_err());
        struct Broken;
        impl Read for Broken {
            fn read(&mut self, _: &mut [u8]) -> std::io::Result<usize> {
                Err(std::io::Error::other("download interrupted"))
            }
        }
        assert!(save_archive(&path, &mut Broken).is_err());
        assert_eq!(std::fs::read(path).unwrap(), new);
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn saves_archive_larger_than_128_mib_without_truncation() {
        let dir = tempfile::tempdir().unwrap();
        let mut source = tempfile::tempfile().unwrap();
        let mut zip = zip::ZipWriter::new(&mut source);
        zip.start_file(
            "large.log",
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored),
        )
        .unwrap();
        const SIZE: u64 = 128 * 1024 * 1024;
        std::io::copy(&mut std::io::repeat(0).take(SIZE), &mut zip).unwrap();
        zip.write_all(b"tail").unwrap();
        zip.finish().unwrap();
        use std::io::{Seek, SeekFrom};
        source.seek(SeekFrom::Start(0)).unwrap();
        let destination = dir.path().join("large.zip");
        save_archive(&destination, &mut source).unwrap();
        let mut saved = zip::ZipArchive::new(std::fs::File::open(destination).unwrap()).unwrap();
        let mut entry = saved.by_name("large.log").unwrap();
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
