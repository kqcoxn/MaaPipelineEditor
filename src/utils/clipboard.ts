import { message, notification } from "antd";

export class ClipboardHelper {
  static async write(
    content: string,
    options?: { successMsg?: string; errorMsg?: string }
  ) {
    const { successMsg = "已成功复制到粘贴板", errorMsg = "复制到粘贴板失败" } =
      options || {};
    try {
      await navigator.clipboard.writeText(content);
      message.success(successMsg);
    } catch (e) {
      notification.error({
        message: errorMsg,
        description: String(e),
        placement: "top",
      });
    }
  }
}
