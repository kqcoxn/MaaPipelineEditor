import "./styles/index.less";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { DesktopStartupGate } from "./components/desktop/DesktopStartupGate";

// 初始化 WebSocket 服务
import { initializeWebSocket } from "./services";
import { initDevConsole } from "./utils/devConsole";

initializeWebSocket();
initDevConsole();

// 创建 React
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DesktopStartupGate>
      <App />
    </DesktopStartupGate>
  </StrictMode>
);
