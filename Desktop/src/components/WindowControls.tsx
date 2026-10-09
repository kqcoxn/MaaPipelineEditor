import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X } from "lucide-react";
import { setError } from "../lib/feedback";
import { isMacOS } from "../lib/platform";

export function WindowControls({ busy }: { busy: boolean }) {
  // AppKit owns macOS window actions, including fullscreen and accessibility.
  if (isMacOS) {
    return <div className="window-drag-region" data-tauri-drag-region aria-hidden="true" />;
  }
  const run = (action: () => Promise<void>) => {
    void action().catch((error) => setError(String(error)));
  };

  return (
    <>
      <div className="window-drag-region" data-tauri-drag-region aria-hidden="true" />
      <div className="window-controls" role="group" aria-label="窗口操作">
        <button
          type="button"
          aria-label="最小化"
          title="最小化"
          onClick={() => run(() => getCurrentWindow().minimize())}
        >
          <Minus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="window-close"
          aria-label="关闭窗口"
          title={busy ? "正在处理，请稍后关闭" : "关闭窗口"}
          disabled={busy}
          onClick={() => run(() => getCurrentWindow().close())}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
