import style from "./styles/App.module.less";

import { useEffect } from "react";
import { Flex, Layout, Splitter, message } from "antd";
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
    function (event) {
      if (event.key === "Delete") {
        // 阻止原始事件，防止冲突
        event.preventDefault();
        event.stopImmediatePropagation();

        // 创建更完整的 Backspace 事件
        const backspaceEvent = new KeyboardEvent("keydown", {
          key: "Backspace",
          code: "Backspace",
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true,
          composed: true,
          // 保持修饰键状态
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          repeat: event.repeat,
          location: event.location,
        });

        // 使用 setTimeout 确保事件在下一个事件循环中触发
        setTimeout(() => {
          // 尝试多个可能的目标
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
  ); // 使用捕获阶段，确保我们的处理优先
}

/**主程序 */
function App() {
  // onMounted
  useEffect(() => {
    // 读取本地存储
    const err = useFileStore.getState().replace();
    if (!err) message.success("已读取本地缓存");

    // 按键重定向
    keyRedirection();
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
