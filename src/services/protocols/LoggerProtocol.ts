import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useLoggerStore } from "../../stores/loggerStore";

interface LogData {
  level: string;
  module: string;
  message: string;
  timestamp: string;
}

/**
 * 日志协议处理器
 * 接收后端推送的日志并存入 loggerStore
 */
export class LoggerProtocol extends BaseProtocol {
  getName(): string {
    return "LoggerProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    this.wsClient.registerRoute("/lte/logger", (data) =>
      this.handleMessage("/lte/logger", data)
    );
  }

  protected handleMessage(_path: string, data: LogData): void {
    if (!data || typeof data !== "object") {
      return;
    }

    const { level, module, message, timestamp } = data;

    if (!level) {
      return;
    }

    // 标准化日志级别
    const normalizedLevel = level.toUpperCase() as "INFO" | "WARN" | "ERROR";
    if (!["INFO", "WARN", "ERROR"].includes(normalizedLevel)) {
      return;
    }

    // 添加到 store
    useLoggerStore.getState().addLog({
      level: normalizedLevel,
      module: module || "Unknown",
      message: message || "",
      timestamp: timestamp || new Date().toISOString(),
    });
  }
}
