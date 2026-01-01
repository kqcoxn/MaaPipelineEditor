import style from "./styles/App.module.less";

import { memo, useCallback, useEffect } from "react";
import {
  Flex,
  Layout,
  message,
  notification,
  Button,
  Space,
  Modal,
} from "antd";
const { Header: HeaderSection, Content } = Layout;

import { useFileStore } from "./stores/fileStore";
import { useConfigStore } from "./stores/configStore";
import { useWSStore } from "./stores/wsStore";
import { useCustomTemplateStore } from "./stores/customTemplateStore";
import { useDebugStore } from "./stores/debugStore";
import { localServer } from "./services/server";

import Header from "./components/Header";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import MainFlow from "./components/Flow";
import JsonViewer from "./components/JsonViewer";
import FieldPanel from "./components/panels/main/FieldPanel";
import EdgePanel from "./components/panels/main/EdgePanel";
import ToolPanel from "./components/panels/tools/ToolPanel";
import SearchPanel from "./components/panels/main/SearchPanel";
import FilePanel from "./components/panels/main/FilePanel";
import ConfigPanel from "./components/panels/main/ConfigPanel";
import AIHistoryPanel from "./components/panels/main/AIHistoryPanel";
import { LocalFileListPanel } from "./components/panels/main/LocalFileListPanel";
import ErrorPanel from "./components/panels/main/ErrorPanel";
import ToolbarPanel from "./components/panels/main/ToolbarPanel";
import { pipelineToFlow } from "./core/parser";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  getShareParam,
  loadFromShareUrl,
  checkPendingImport,
  handleImportFromUrl,
  clearImportParam,
} from "./utils/shareHelper";
import { parseUrlParams } from "./utils/urlHelper";

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
    title: "来点 Star，秋梨膏！",
    description:
      "如果 MaaPipelineEditor 对您有帮助，可以为项目点一个免费的 Star⭐ 吗 QAQ",
    actions: operations,
    key,
    duration: 0,
    closeIcon: false,
  });
}

// 全局监听
const GlobalListener = memo(() => {
  return null;
});

/**主程序 */
function App() {
  // 获取调试模式状态
  const debugMode = useDebugStore((state) => state.debugMode);

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
      const success = await pipelineToFlow({ pString: text });
      if (success) {
        message.success(`已导入文件: ${file.name}`);
      }
    } catch (err) {
      message.error("文件导入失败，请检查文件格式");
      console.error(err);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 启用全局快捷键
  useGlobalShortcuts();

  // onMounted
  useEffect(() => {
    // 检查是否有分享链接参数
    const hasShareParam = !!getShareParam();

    // 检查是否有导入请求
    const { hasPending, startIn, expectedFile } = checkPendingImport();

    // 读取本地存储
    if (!hasShareParam && !hasPending) {
      const err = useFileStore.getState().replace();
      if (!err) message.success("已读取本地缓存");
    }

    // 从分享链接加载
    if (hasShareParam) {
      loadFromShareUrl();
    }

    // 处理导入请求
    if (hasPending) {
      const dirMap: Record<string, string> = {
        desktop: "桌面",
        documents: "文档",
        downloads: "下载",
        music: "音乐",
        pictures: "图片",
        videos: "视频",
      };

      const dirName = dirMap[startIn || "downloads"] || startIn;
      const content = expectedFile
        ? `是否从 "${dirName}" 目录选择文件 "${expectedFile}" 导入？`
        : `是否从 "${dirName}" 目录选择文件导入？`;

      Modal.confirm({
        title: "检测到导入请求",
        content,
        okText: "选择文件",
        cancelText: "取消",
        onOk: () => handleImportFromUrl(),
        onCancel: () => clearImportParam(),
      });
    }

    // 加载自定义模板
    useCustomTemplateStore.getState().loadTemplates();

    // 注册WebSocket状态同步回调
    const setConnected = useWSStore.getState().setConnected;
    const setConnecting = useWSStore.getState().setConnecting;
    localServer.onStatus((connected) => {
      setConnected(connected);
    });
    localServer.onConnecting((isConnecting) => {
      setConnecting(isConnecting);
    });

    // WebSocket自动连接
    const wsAutoConnect = useConfigStore.getState().configs.wsAutoConnect;

    // 统一解析 URL 参数
    const urlParams = parseUrlParams();

    // 自动连接或者 URL 参数连接
    if (wsAutoConnect || urlParams.linkLb) {
      localServer.connect();
    }

    // Star定时提醒
    if (localStorage.getItem("_mpe_stared") !== "true") {
      setInterval(() => {
        if (!isShowStarRemind) {
          starRemind();
        }
      }, 5 * 60 * 1000);
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
    <ThemeProvider>
      <Flex className={style.container} gap="middle" wrap>
        <Layout className={style.layout}>
          <HeaderSection className={style.header}>
            <Header />
          </HeaderSection>
          <Content className={style.content}>
            <FilePanel />
            <div className={style.workspace}>
              <ToolbarPanel />
              <MainFlow />
              <JsonViewer />
              <FieldPanel />
              <EdgePanel />
              <ConfigPanel />
              <AIHistoryPanel />
              <LocalFileListPanel />
              <ToolPanel.Add />
              <ToolPanel.Global />
              <SearchPanel />
              {debugMode && <ToolPanel.Debug />}
              <ToolPanel.Layout />
              <ErrorPanel />
            </div>
          </Content>
        </Layout>
      </Flex>
      <GlobalListener />
    </ThemeProvider>
  );
}

export default App;
