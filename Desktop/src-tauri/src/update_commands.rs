use tauri::WebviewWindow;

#[tauri::command]
pub async fn check_desktop_update(
    window: WebviewWindow,
    app: tauri::AppHandle,
    cached: bool,
) -> Result<bool, String> {
    crate::commands::authorize(&window, "launcher")?;
    let started = std::time::Instant::now();
    let result = crate::desktop_update::check(&app, cached).await;
    if let Err(error) = &result {
        crate::logs::record(&app, &format!("桌面端版本检查失败：{error}"));
    } else {
        crate::logs::record(
            &app,
            &format!(
                "桌面端版本检查完成，耗时 {:.2} 秒",
                started.elapsed().as_secs_f64()
            ),
        );
    }
    result
}
