import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";

/**
 * 错误协议处理器
 * 统一处理所有错误消息
 */
export class ErrorProtocol extends BaseProtocol {
  getName(): string {
    return "ErrorProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    this.wsClient.registerRoute("/error", (data) => this.handleMessage("/error", data));
  }

  protected handleMessage(path: string, data: any): void {
    const { code, message: msg, detail } = data;
    
    // 根据错误码显示不同的提示
    const errorMessages: Record<string, string> = {
      FILE_NOT_FOUND: "文件不存在或已被删除",
      FILE_READ_ERROR: "文件读取失败，请检查权限",
      FILE_WRITE_ERROR: `文件保存失败：${msg || "未知错误"}`,
      FILE_NAME_CONFLICT: "文件名已存在，请使用不同的名称",
      INVALID_JSON: `JSON 格式错误：${msg || ""}`,
      PERMISSION_DENIED: "无权限访问该文件",
    };

    const displayMessage = errorMessages[code] || msg || "未知错误";
    
    console.error("[ErrorProtocol]", { code, message: msg, detail });
    message.error(displayMessage);
  }
}
