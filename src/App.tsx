import style from "./styles/App.module.less";

import { useEffect, memo } from "react";
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

/**主程序 */
function App() {
  // onMounted
  useEffect(() => {
    // 读取本地存储
    const err = useFileStore.getState().replace();
    if (!err) message.success("已读取本地缓存");

    // 按键重定向
    document.addEventListener("keydown", function (event) {
      if (event.key === "Delete") {
        event.preventDefault();
        const backspaceEvent = new KeyboardEvent("keydown", {
          key: "Backspace",
          code: "Backspace",
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true,
        });
        event.target?.dispatchEvent(backspaceEvent);
      }
    });
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
