use crate::settings::{data_dir, engine_dir};
use std::path::{Component, Path};
use tauri::http::{Request, Response};
pub fn read(app: &tauri::AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = percent_encoding::percent_decode_str(request.uri().path())
        .decode_utf8_lossy()
        .into_owned();
    let relative = path.trim_start_matches('/');
    let response = |code, body: Vec<u8>, mime: &str| {
        Response::builder()
            .status(code)
            .header("Content-Type", mime)
            .header("X-Content-Type-Options", "nosniff")
            .body(body)
            .unwrap()
    };
    if !valid_relative(relative) {
        return response(403, vec![], "text/plain");
    }
    let root = engine_dir().join("editor");
    let file = if relative == "__background" {
        data_dir(app).join("background")
    } else {
        root.join(if relative.is_empty() {
            "index.html"
        } else {
            relative
        })
    };
    if relative != "__background" {
        match (root.canonicalize(), file.canonicalize()) {
            (Ok(root), Ok(file)) if file.starts_with(&root) => {}
            _ => return response(404, vec![], "text/plain"),
        }
    }
    match std::fs::read(&file) {
        Ok(bytes) => {
            let mime = if relative == "__background" {
                if bytes.starts_with(b"\x89PNG") {
                    "image/png".into()
                } else if bytes.starts_with(b"RIFF") {
                    "image/webp".into()
                } else {
                    "image/jpeg".into()
                }
            } else {
                mime_guess::from_path(file)
                    .first_or_octet_stream()
                    .to_string()
            };
            Response::builder().header("Content-Type",mime).header("Cache-Control","no-store").header("Content-Security-Policy","default-src 'self' data: blob:; script-src 'self' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ipc: http://ipc.localhost ws://127.0.0.1:* ws://localhost:* https:; worker-src 'self' blob:").body(bytes).unwrap()
        }
        Err(_) => response(404, vec![], "text/plain"),
    }
}

fn valid_relative(path: &str) -> bool {
    !Path::new(path).is_absolute()
        && !path.contains('\\')
        && !path.contains(':')
        && Path::new(path)
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn blocks_traversal_and_windows_device_paths() {
        for path in [
            "../settings.json",
            "assets/../../settings.json",
            "C:/Users/a",
            "assets\\secret",
            "/etc/passwd",
        ] {
            assert!(!valid_relative(path), "{path}");
        }
    }
    #[test]
    fn accepts_nested_editor_assets() {
        for path in [
            "",
            "index.html",
            "assets/editor.js",
            "monaco-editor/min/vs/loader.js",
        ] {
            assert!(valid_relative(path), "{path}");
        }
    }
}
