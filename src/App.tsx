import style from "./styles/App.module.less";

import { memo, useCallback, useEffect } from "react";
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
import {
  enable as enableDarkMode,
  disable as disableDarkMode,
} from "darkreader";

import { useFileStore } from "./stores/fileStore";

import Header from "./components/Header";
import MainFlow from "./components/Flow";
import JsonViewer from "./components/JsonViewer";
import FieldPanel from "./components/panels/FieldPanel";
import ToolPanel from "./components/panels/ToolPanel";
import FilePanel from "./components/panels/FilePanel";
import ConfigPanel from "./components/panels/ConfigPanel";
import ErrorPanel from "./components/panels/ErrorPanel";
import { useConfigStore } from "./stores/configStore";
import { pipelineToFlow } from "./core/parser";

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

// 全局监听
const GlobalListener = memo(() => {
  // 黑夜模式
  const useDarkMode = useConfigStore((state) => state.configs.useDarkMode);
  useEffect(() => {
    if (useDarkMode) {
      enableDarkMode({
        brightness: 100,
        contrast: 90,
        sepia: 10,
      });
    } else {
      disableDarkMode();
    }
  }, [useDarkMode]);

  return null;
});

/**主程序 */
function App() {
  // 处理文件拖拽
  const handleFileDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    // 检查文件类型
    if (!file.name.endsWith(".json") && !file.name.endsWith(".jsonc")) {
      message.error("仅支持 .json 或 .jsonc 文件");
      return;
    }

    try {
      const text = await file.text();
      await pipelineToFlow({ pString: text });
      message.success(`已导入文件: ${file.name}`);
    } catch (err) {
      message.error("文件导入失败，请检查文件格式");
      console.error(err);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

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

    // 文件拖拽监听
    document.addEventListener("drop", handleFileDrop);
    document.addEventListener("dragover", handleDragOver);

    // 清理监听器
    return () => {
      document.removeEventListener("drop", handleFileDrop);
      document.removeEventListener("dragover", handleDragOver);
    };
  }, [handleFileDrop, handleDragOver]);

  // 渲染组件
  return (
    <>
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
      <GlobalListener />
    </>
  );
}

export default App;
