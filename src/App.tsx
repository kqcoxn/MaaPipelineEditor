import style from "./styles/App.module.less";

import { useEffect } from "react";
import {
  Flex,
  Layout,
  Splitter,
  message,
  notification,
  Button,
  Space,
} from "antd";
const { Header: HeaderSection, Content } = Layout;

import { useFileStore } from "./stores/fileStore";

import Header from "./components/Header";
import MainFlow from "./components/Flow";
import JsonViewer from "./components/JsonViewer";
import FieldPanel from "./components/panels/FieldPanel";
import ToolPanel from "./components/panels/ToolPanel";
import FilePanel from "./components/panels/FilePanel";
import ConfigPanel from "./components/panels/ConfigPanel";
import ErrorPanel from "./components/panels/ErrorPanel";

// 按键重定向
function keyRedirection() {
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Delete") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const backspaceEvent = new KeyboardEvent("keydown", {
          key: "Backspace",
          code: "Backspace",
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true,
          composed: true,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          repeat: event.repeat,
          location: event.location,
        });
        setTimeout(() => {
          const reactFlowElement =
            document.querySelector(".react-flow") ||
            document.querySelector('[data-testid="rf__wrapper"]') ||
            document.activeElement ||
            document.body;
          if (reactFlowElement) {
            reactFlowElement.dispatchEvent(backspaceEvent);
          }
        }, 0);
      }
    },
    true
  );
}

// 轮询提醒
let isShowStarRemind = false;
function starRemind() {
  isShowStarRemind = true;
  const key = `open${Date.now()}`;
  const operations = (
    <Space>
      <Button
        type="primary"
        onClick={() => {
          window.open("https://github.com/kqcoxn/MaaPipelineEditor");
          localStorage.setItem("mpe_stared", "true");
          notification.destroy();
        }}
      >
        这就去点！
      </Button>
      <Button
        onClick={() => {
          isShowStarRemind = false;
          notification.destroy();
        }}
      >
        稍后提醒
      </Button>
      <Button
        style={{ color: "gray" }}
        type="dashed"
        onClick={() => {
          localStorage.setItem("_mpe_stared", "true");
          notification.destroy();
        }}
      >
        不再提醒
      </Button>
    </Space>
  );
  notification.open({
    message: "来点 Star，秋梨膏！",
    description:
      "如果 MaaPipelineEditor 对您有帮助，可以为项目点一个免费的 Star⭐ 吗 QAQ",
    actions: operations,
    key,
    duration: null,
    closeIcon: false,
  });
}

/**主程序 */
function App() {
  // onMounted
  useEffect(() => {
    // 按键重定向
    keyRedirection();
    // 读取本地存储
    const err = useFileStore.getState().replace();
    if (!err) message.success("已读取本地缓存");
    // Star定时提醒
    if (localStorage.getItem("_mpe_stared") !== "true") {
      setInterval(() => {
        if (!isShowStarRemind) {
          starRemind();
        }
      }, 10 * 60 * 1000);
    }
  }, []);

  // 渲染组件
  return (
    <Flex className={style.container} gap="middle" wrap>
      <Layout className={style.layout}>
        <HeaderSection className={style.header}>
          <Header />
        </HeaderSection>
        <Content className={style.content}>
          <FilePanel />
          <Splitter className={style.workspace}>
            <Splitter.Panel className={style.left}>
              <MainFlow />
              <FieldPanel />
              <ConfigPanel />
              <ToolPanel.Add />
              <ToolPanel.Global />
              <ToolPanel.Layout />
              <ErrorPanel />
            </Splitter.Panel>
            <Splitter.Panel defaultSize={350} min={300} max="50%" collapsible>
              <JsonViewer />
            </Splitter.Panel>
          </Splitter>
        </Content>
      </Layout>
    </Flex>
  );
}

export default App;
