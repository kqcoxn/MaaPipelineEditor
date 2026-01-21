import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";

/**
 * 后端配置数据结构
 */
export interface BackendConfig {
  server: {
    port: number;
    host: string;
  };
  file: {
    root: string;
    exclude: string[];
    extensions: string[];
  };
  log: {
    level: string;
    dir: string;
    push_to_client: boolean;
  };
  maafw: {
    enabled: boolean;
    lib_dir: string;
    resource_dir: string;
  };
}

/**
 * 配置响应数据结构
 */
export interface ConfigResponse {
  success: boolean;
  config: BackendConfig;
  config_path: string;
  message?: string;
}

/**
 * 配置协议处理器
 * 处理后端配置相关的WebSocket消息
 */
export class ConfigProtocol extends BaseProtocol {
  // 配置数据回调
  private configCallbacks: ((data: ConfigResponse) => void)[] = [];
  // 重载回调
  private reloadCallbacks: ((data: any) => void)[] = [];

  getName(): string {
    return "ConfigProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 注册接收路由
    this.wsClient.registerRoute("/lte/config/data", (data) =>
      this.handleConfigData(data)
    );
    this.wsClient.registerRoute("/lte/config/reload", (data) =>
      this.handleReloadResponse(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    // 统一的消息处理入口
  }

  /**
   * 处理配置数据推送
   * 路由: /lte/config/data
   */
  private handleConfigData(data: ConfigResponse): void {
    try {
      if (!data.success) {
        message.error(data.message || "获取配置失败");
        return;
      }

      // 通知所有回调
      this.configCallbacks.forEach((callback) => callback(data));

      // 如果有保存成功的消息，显示提示
      if (data.message) {
        message.success(data.message);
      }
    } catch (error) {
      console.error("[ConfigProtocol] Failed to handle config data:", error);
      message.error("配置数据处理失败");
    }
  }

  /**
   * 处理重载响应
   * 路由: /lte/config/reload
   */
  private handleReloadResponse(data: any): void {
    try {
      if (!data.success) {
        message.error(data.error || "重载失败");
        return;
      }

      message.success("配置重载完成");

      // 通知所有回调
      this.reloadCallbacks.forEach((callback) => callback(data));
    } catch (error) {
      console.error(
        "[ConfigProtocol] Failed to handle reload response:",
        error
      );
      message.error("重载响应处理失败");
    }
  }

  /**
   * 请求获取配置
   * 发送路由: /etl/config/get
   */
  public requestGetConfig(): boolean {
    if (!this.wsClient) {
      console.error("[ConfigProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/config/get", {});
  }

  /**
   * 请求设置配置
   * 发送路由: /etl/config/set
   */
  public requestSetConfig(config: Partial<BackendConfig>): boolean {
    if (!this.wsClient) {
      console.error("[ConfigProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/config/set", config);
  }

  /**
   * 请求重载配置
   * 发送路由: /etl/config/reload
   */
  public requestReload(): boolean {
    if (!this.wsClient) {
      console.error("[ConfigProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/config/reload", {});
  }

  /**
   * 注册配置数据回调
   * @param callback 配置数据回调函数
   * @returns 注销函数
   */
  public onConfigData(callback: (data: ConfigResponse) => void): () => void {
    this.configCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.configCallbacks.indexOf(callback);
      if (index > -1) {
        this.configCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册重载回调
   * @param callback 重载回调函数
   * @returns 注销函数
   */
  public onReload(callback: (data: any) => void): () => void {
    this.reloadCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.reloadCallbacks.indexOf(callback);
      if (index > -1) {
        this.reloadCallbacks.splice(index, 1);
      }
    };
  }
}
