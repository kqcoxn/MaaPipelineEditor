use tauri::Manager;

pub fn configure(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    #[cfg(target_os = "macos")]
    let builder = builder.on_web_content_process_terminate(|webview| {
        if webview.label() == "renderer" {
            crate::session::aborted(webview.app_handle().clone());
        }
    });
    builder
}

pub fn watch(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        use tauri::Emitter;
        use webview2_com::{
            Microsoft::Web::WebView2::Win32::{
                COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED,
                COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED,
            },
            ProcessFailedEventHandler,
        };
        let app = window.app_handle().clone();
        let fallback = app.clone();
        let result = window.with_webview(move |view| unsafe {
            let registered = (|| {
                let core = view.controller().CoreWebView2()?;
                let owner = app.clone();
                let mut token = 0;
                core.add_ProcessFailed(
                    &ProcessFailedEventHandler::create(Box::new(move |_, args| {
                        if let Some(args) = args {
                            let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED;
                            args.ProcessFailedKind(&mut kind)?;
                            // GPU/subframe failures may recover without losing the editor.
                            if kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED
                                || kind == COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED
                            {
                                crate::session::aborted(owner.clone());
                            }
                        }
                        Ok(())
                    })),
                    &mut token,
                )
            })();
            if let Err(error) = registered {
                let _ = app.emit_to(
                    "launcher",
                    "session-error",
                    format!("无法监听编辑器进程: {error}"),
                );
                crate::session::aborted(app);
            }
        });
        if result.is_err() {
            crate::session::aborted(fallback);
        }
    }
    #[cfg(not(windows))]
    let _ = window;
}
