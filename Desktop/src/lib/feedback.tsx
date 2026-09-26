import { toast } from "sonner";

export type NoticeKind = "info" | "success" | "pending" | "action" | "error";
export type FeedbackScope =
  "operation" | "environment" | "token" | "desktop" | `test-${string}`;
const feedbackId = (scope: FeedbackScope) => `launcher-${scope}`;

/** One operation owns one notification; later results replace earlier stages. */
export function clearFeedback(scope: FeedbackScope = "operation") {
  toast.dismiss(feedbackId(scope));
}

export function setNotice(
  message: string,
  kind: NoticeKind = "info",
  scope: FeedbackScope = "operation",
) {
  if (!message) return clearFeedback(scope);
  if (kind === "error") return setError(message, scope);
  const persistent = kind === "pending" || kind === "action";
  const type =
    kind === "pending" ? "info" : kind === "action" ? "warning" : kind;
  toast[type](message, {
    id: feedbackId(scope),
    description: undefined,
    duration: persistent ? Infinity : message.length > 45 ? 8000 : 4500,
  });
}

export function setError(message: string, scope: FeedbackScope = "operation") {
  if (!message) return clearFeedback(scope);
  const rateLimited =
    message.includes("api.github.com") && /rate limit/i.test(message);
  toast.error(rateLimited ? "暂时无法获取更新信息" : "操作未完成", {
    id: feedbackId(scope),
    duration: Infinity,
    description: (
      <div>
        <p>
          {rateLimited
            ? "GitHub 请求已达限额，请稍后重试。"
            : "请查看详情，处理后重试。"}
        </p>
        <details key={message} className="feedback-details">
          <summary>查看错误详情</summary>
          <pre className="selectable-text">{message}</pre>
        </details>
      </div>
    ),
  });
}
