import { X } from "lucide-react";
import type { useLauncher } from "../model";

/** Notifications never take height away from the launcher workspace. */
export function LauncherFeedback({
  model: m,
}: {
  model: ReturnType<typeof useLauncher>;
}) {
  const rateLimited =
    m.error.includes("api.github.com") && /rate limit/i.test(m.error);
  return (
    <div className="launcher-feedback">
      {m.error && (
        <div className="banner error" role="alert">
          <div className="feedback-copy">
            <strong>
              {rateLimited ? "暂时无法获取更新信息" : "操作未完成"}
            </strong>
            {rateLimited && <p>GitHub 请求已达限额，请稍后重试。</p>}
            <details key={m.error}>
              <summary>查看错误详情</summary>
              <p className="selectable-text">{m.error}</p>
            </details>
          </div>
          <button aria-label="关闭错误提示" onClick={() => m.setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {m.notice && (
        <div className="banner" role="status">
          <span>{m.notice}</span>
          <button aria-label="关闭提示" onClick={() => m.setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
