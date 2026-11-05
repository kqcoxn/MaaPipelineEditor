use crate::{commands::authorize, exports::display_path};
use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn desktop_pick_path(
    window: WebviewWindow,
    app: tauri::AppHandle,
    kind: String,
) -> Result<Option<String>, String> {
    authorize(&window, "renderer")?;
    if kind != "file" && kind != "directory" {
        return Err("无效的路径类型".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let dialog = app.dialog().file().set_parent(&window);
        let selected = if kind == "directory" {
            dialog.set_title("选择文件夹").blocking_pick_folder()
        } else {
            dialog.set_title("选择文件").blocking_pick_file()
        };
        selected
            .map(|file| {
                file.into_path()
                    .map(|path| display_path(&path))
                    .map_err(|e| e.to_string())
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}
