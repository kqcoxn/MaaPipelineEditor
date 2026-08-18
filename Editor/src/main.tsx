import "./styles/index.less";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App as AntdApp } from "antd";
import antdZhCN from "antd/locale/zh_CN";
import { XProvider } from "@ant-design/x";
import xZhCN from "@ant-design/x/locale/zh_CN";
import App from "./App.tsx";
import { AntdFeedbackBridge } from "./components/AntdFeedbackBridge";

// 初始化 WebSocket 服务
import { initializeWebSocket } from "./services";
import { initDevConsole } from "./utils/devConsole";

initializeWebSocket();
initDevConsole();

// 创建 React
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <XProvider locale={{ ...antdZhCN, ...xZhCN }}>
      <AntdApp component={false}>
        <AntdFeedbackBridge />
        <App />
      </AntdApp>
    </XProvider>
  </StrictMode>
);
