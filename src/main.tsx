import "./styles/index.less";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// 初始化 WebSocket 服务
import {
  localServer,
  initializeWebSocket,
  registerRespondRoutes,
} from "./services";

// 显式初始化 WebSocket 和响应路由（仅调用一次）
registerRespondRoutes(localServer);
initializeWebSocket();

// 创建 React
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
