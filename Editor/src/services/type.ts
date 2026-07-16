// 系统路由
export const SystemRoutes = {
  HANDSHAKE: "/system/handshake",
  HANDSHAKE_RESPONSE: "/system/handshake/response",
} as const;

// 版本握手请求
export interface HandshakeRequest {
  protocol_version: string;
}

// 版本握手响应
export interface HandshakeResponse {
  success: boolean;
  server_version: string;
  required_version: string;
  message: string;
}

// 消息处理函数类型
export type MessageHandler = (data: any, ws: WebSocket) => void;

// API 路由接口
export interface APIRoute {
  path: string;
  handler: MessageHandler;
}
