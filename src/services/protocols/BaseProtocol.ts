import type { LocalWebSocketServer } from "../server";

/**
 * 协议模块基类
 * 所有协议模块都需要继承此类并实现相应方法
 */
export abstract class BaseProtocol {
  protected wsClient: LocalWebSocketServer | null = null;

  /**
   * 获取协议名称
   */
  abstract getName(): string;

  /**
   * 获取协议版本
   */
  abstract getVersion(): string;

  /**
   * 注册协议路由
   * @param wsClient WebSocket客户端实例
   */
  abstract register(wsClient: LocalWebSocketServer): void;

  /**
   * 注销协议路由
   */
  unregister(): void {
    this.wsClient = null;
  }

  /**
   * 消息处理入口
   * @param path 路由路径
   * @param data 消息数据
   */
  protected abstract handleMessage(path: string, data: any): void;
}
