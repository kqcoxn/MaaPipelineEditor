import style from "./styles/layout/App.module.less";

import { memo, Suspense, lazy, useCallback, useEffect } from "react";
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

import { useFileStore } from "@/stores/project/fileStore";
import {
  initializeConfigCache,
  useConfigStore,
} from "@/stores/app/configStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useCustomTemplateStore } from "@/stores/project/customTemplateStore";
import { localServer } from "./services/server";
import { resetDebugProtocolStateForConnectionLoss } from "./features/debug/protocols/registerProtocolListeners";

import Header from "./components/Header";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import MainFlow from "./components/Flow";
import FieldPanel from "./components/panels/main/FieldPanel";
import EdgePanel from "./components/panels/main/EdgePanel";
import LiveScreenPanel from "./components/panels/main/LiveScreenPanel";
import ToolPanel from "./components/panels/tools/ToolPanel";
import SearchPanel from "./components/panels/main/SearchPanel";
import FilePanel from "./components/panels/main/FilePanel";
import SettingsPanel from "./components/panels/settings/SettingsPanel";
import FileConfigPanel from "./components/panels/main/FileConfigPanel";
import { LocalFileListPanel } from "./components/panels/main/LocalFileListPanel";
import ErrorPanel from "./components/panels/main/ErrorPanel";
import AIHistoryPanel from "./components/panels/main/AIHistoryPanel";
import BusinessArchitecturePanel from "./components/panels/main/BusinessArchitecturePanel";
import ToolbarPanel from "./components/panels/main/ToolbarPanel";
import { LoggerPanel } from "./components/panels/tools/LoggerPanel";
import { pipelineToFlow } from "./core/parser";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  getShareParam,
  loadFromShareUrl,
  checkPendingImport,
  handleImportFromUrl,
  clearImportParam,
} from "./utils/data/shareHelper";
import { parseUrlParams } from "./utils/data/urlHelper";
import { isEmbedEnvironment } from "./utils/embedBridge";
import { useEmbedMode } from "./hooks/useEmbedMode";
import { useEmbedChangeNotifier } from "./hooks/useEmbedChangeNotifier";
import { registerEmbedProtocol } from "./features/embed/protocols/registerEmbedProtocol";
import {
  useNewcomerStore,
  isNewcomerPassed,
} from "@/stores/ui/newcomerStore";
import { NewcomerGuideModal } from "./components/modals/NewcomerGuideModal";
import { useTermsStore, isTermsAccepted } from "@/stores/ui/termsStore";
import { TermsAgreementModal } from "./components/modals/TermsAgreementModal";
import { useEmbedStarReminder } from "./hooks/useEmbedStarReminder";
import { openExternalUrl } from "./features/embed/navigation/externalNavigation";

const JsonViewer = lazy(() => import("./components/JsonViewer"));
const DebugModal = lazy(() =>
  import("./components/debug/DebugModal").then((module) => ({
    default: module.DebugModal,
  })),
);

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
          openExternalUrl("https://github.com/kqcoxn/MaaPipelineEditor");
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
  // 嵌入模式状态
  const { isEmbed, isReady, isCapAllowed, isPanelHidden } = useEmbedMode();

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

  // 启用全局快捷键（嵌入模式下根据 capabilities 控制）
  const enableShortcuts =
    !isEmbed || (isCapAllowed("allowUndoRedo") && !isCapAllowed("readOnly"));
  useGlobalShortcuts(enableShortcuts);

  // 嵌入模式变更通知
  useEmbedChangeNotifier(isEmbed && isReady);
  useEmbedStarReminder();

  // onMounted
  useEffect(() => {
    // 检查是否为嵌入模式（最高优先级）
    const embedEnvironment = isEmbedEnvironment();
    if (embedEnvironment) {
      console.log("[App] Embed mode detected");

      useTermsStore.getState().closeModal();
      useNewcomerStore.getState().closeModal();
    }

    const unsubscribeConfigCache = initializeConfigCache();

    if (embedEnvironment) {
      const disposeEmbedProtocol = registerEmbedProtocol();
      return () => {
        unsubscribeConfigCache();
        disposeEmbedProtocol();
      };
    }

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
    const clearMFWConnection = useMFWStore.getState().clearConnection;
    localServer.onStatus((connected) => {
      setConnected(connected);
      // WebSocket 断开时清除设备连接状态，确保实时画面等 UI 正确隐藏
      if (!connected) {
        clearMFWConnection();
        // 调试会话只存在于当前 LocalBridge 进程，断线/重启后必须丢弃旧 ID。
        resetDebugProtocolStateForConnectionLoss();
      }
    });
    localServer.onConnecting((isConnecting) => {
      setConnecting(isConnecting);
    });

    // WebSocket自动连接
    const wsAutoConnect = useConfigStore.getState().configs.wsAutoConnect;
    const configuredPort = useConfigStore.getState().configs.wsPort;

    // 统一解析 URL 参数
    const urlParams = parseUrlParams();

    // 使用 URL 参数或配置连接 LocalBridge
    const targetPort = urlParams.port || configuredPort;
    if (targetPort) {
      localServer.setPort(targetPort);
    }

    if (wsAutoConnect || urlParams.linkLb) {
      localServer.connect();
    }

    // 使用协议检测（优先于新手引导）
    if (!isTermsAccepted()) {
      useTermsStore.getState().openModal();
    } else if (!isNewcomerPassed()) {
      // 协议已接受，检测新手引导
      useNewcomerStore.getState().openModal();
    }

    // 监听协议接受事件，接受后再触发新手引导检测
    const handleTermsAccepted = () => {
      if (!isNewcomerPassed()) {
        useNewcomerStore.getState().openModal();
      }
    };
    window.addEventListener("mpe:terms-accepted", handleTermsAccepted);

    // Star定时提醒（需通过新手测试后才启动）
    if (
      localStorage.getItem("_mpe_stared") !== "true" &&
      isNewcomerPassed()
    ) {
      setInterval(
        () => {
          if (!isShowStarRemind) {
            starRemind();
          }
        },
        5 * 60 * 1000,
      );
    }

    // 文件拖拽监听
    document.addEventListener("drop", handleFileDrop);
    document.addEventListener("dragover", handleDragOver);

    // 清理监听器
    return () => {
      unsubscribeConfigCache();
      window.removeEventListener("mpe:terms-accepted", handleTermsAccepted);
      document.removeEventListener("drop", handleFileDrop);
      document.removeEventListener("dragover", handleDragOver);
    };
  }, [handleFileDrop, handleDragOver]);

  // 条件渲染控制
  const showHeader = !isEmbed || !isPanelHidden("header");
  const showToolbar = !isEmbed || !isPanelHidden("toolbar");
  const showPanel = (id: string) => !isEmbed || !isPanelHidden(id);

  // 渲染组件
  return (
    <ThemeProvider>
      <Flex className={style.container} gap="middle" wrap>
        <Layout className={style.layout}>
          {showHeader && (
            <HeaderSection className={style.header}>
              <Header />
            </HeaderSection>
          )}
          <Content className={style.content}>
            {showPanel("file") && <FilePanel />}
            <div className={style.workspace}>
              {showToolbar && <ToolbarPanel />}
              <MainFlow />
              {showPanel("ai-history") && <AIHistoryPanel />}
              {showPanel("business-architecture") && (
                <BusinessArchitecturePanel />
              )}
              {showPanel("json") && (
                <Suspense fallback={null}>
                  <JsonViewer />
                </Suspense>
              )}
              {showPanel("liveScreen") && <LiveScreenPanel />}
              {showPanel("field") && <FieldPanel />}
              {showPanel("edge") && <EdgePanel />}
              {showPanel("config") && <SettingsPanel />}
              {showPanel("config") && <FileConfigPanel />}
              {showPanel("local-file") && <LocalFileListPanel />}
              <ToolPanel.Add />
              <ToolPanel.Global />
              {showPanel("search") && <SearchPanel />}
              <ToolPanel.Layout />
              {showPanel("error") && <ErrorPanel />}
              {showPanel("logger") && <LoggerPanel />}
            </div>
          </Content>
        </Layout>
      </Flex>
      <Suspense fallback={null}>
        <DebugModal />
      </Suspense>
      {!isEmbed && <TermsAgreementModal />}
      {!isEmbed && <NewcomerGuideModal />}
      <GlobalListener />
    </ThemeProvider>
  );
}

export default App;
