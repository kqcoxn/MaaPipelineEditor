// 消息处理函数类型
type MessageHandler = (data: any, ws: WebSocket) => void;

// API 路由接口
interface APIRoute {
  path: string;
  handler: MessageHandler;
}

export type { MessageHandler, APIRoute };
