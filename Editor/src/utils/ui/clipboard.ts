import { message, notification } from "antd";
import uiT from "../../i18n/translate";

export class ClipboardHelper {
  static async write(
    content: any,
    options?: { successMsg?: string; errorMsg?: string }
  ): Promise<boolean> {
    const {
      successMsg = uiT("ui.utils.clipboard.copySuccess", "已成功复制到粘贴板"),
      errorMsg = uiT("ui.utils.clipboard.copyFailed", "复制到粘贴板失败"),
    } = options || {};
    try {
      if (typeof content !== "string") content = JSON.stringify(content);
      await navigator.clipboard.writeText(content);
      message.success(successMsg);
    } catch (err) {
      notification.error({
        title: errorMsg,
        description: String(err),
        placement: "top",
      });
      return false;
    }
    return true;
  }

  static async writeString(
    content: string,
    options?: { successMsg?: string; errorMsg?: string }
  ): Promise<boolean> {
    const {
      successMsg = uiT("ui.utils.clipboard.copySuccess", "已成功复制到粘贴板"),
      errorMsg = uiT("ui.utils.clipboard.copyFailed", "复制到粘贴板失败"),
    } = options || {};
    try {
      await navigator.clipboard.writeText(content);
      message.success(successMsg);
    } catch (err) {
      notification.error({
        title: errorMsg,
        description: String(err),
        placement: "top",
      });
      return false;
    }
    return true;
  }

  static async read(options?: {
    successMsg?: string;
    errorMsg?: string;
  }): Promise<string> {
    const {
      successMsg,
      errorMsg = uiT("ui.utils.clipboard.readFailed", "读取粘贴板失败"),
    } = options || {};
    try {
      const text = await navigator.clipboard.readText();
      if (successMsg) message.success(successMsg);
      return text;
    } catch (err) {
      notification.error({
        title: errorMsg,
        description: String(err),
        placement: "top",
      });
      return "";
    }
  }
}
