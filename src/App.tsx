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
  document.addEventListener("keydown", function (event) {
    console.log("注册按键重定向");
    if (event.key === "Delete") {
      const backspaceEvent = new KeyboardEvent("keydown", {
        key: "Backspace",
        code: "Backspace",
        keyCode: 8,
        which: 8,
        bubbles: true,
        cancelable: true,
      });

      console.log("触发按键");
      event.target?.dispatchEvent(backspaceEvent);
    }
  });
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
