// 消息处理函数类型
export type MessageHandler = (data: any, ws: WebSocket) => void;

// API 路由接口
export interface APIRoute {
  path: string;
  handler: MessageHandler;
}
