import "./styles/index.less";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// 初始化 WebSocket 服务
import { initializeWebSocket } from "./services";

initializeWebSocket();

// 创建 React
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
