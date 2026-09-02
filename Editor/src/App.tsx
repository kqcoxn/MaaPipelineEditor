import style from "./styles/layout/App.module.less";

import { useCallback, useEffect } from "react";
import { Flex, Layout, message, Modal } from "antd";
const { Header: HeaderSection, Content } = Layout;

import {
  initializeFileCachePersistence,
  restoreFileCache,
} from "@/stores/project/fileCachePersistence";
import {
  initializeConfigCache,
  useConfigStore,
} from "@/stores/app/configStore";
import { useCustomTemplateStore } from "@/stores/project/customTemplateStore";
import { initializeLocalBridgeConnectionState } from "./services/localBridgeConnection";
import { localServer } from "./services/server";

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
import { useStarReminder } from "./hooks/useStarReminder";
import { LazyFeature } from "./components/async/LazyFeature";
import { OptionalFeatureHosts } from "./components/async/OptionalFeatureHosts";
import { GlobalProcessOverlay } from "./components/async/GlobalProcessOverlay";
import {
  finishBootScreenWhenReady,
  updateBootScreen,
} from "./components/async/bootScreen";
import { DebugRuntimeHost } from "./components/debug/DebugRuntimeHost";

const isPreviewMode = import.meta.env.MODE === "preview";

const loadJsonViewer = () => import("./components/JsonViewer");

/**主程序 */
function App() {
  // 嵌入模式状态
  const { isEmbed, isReady, isCapAllowed, isPanelHidden } = useEmbedMode();
  const shouldSkipNewcomerGuide = isEmbed || isPreviewMode;

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
  useStarReminder(isEmbed);

  // onMounted
  useEffect(() => {
    let disposed = false;
    let disposeFileCache = () => undefined;
    let disposeLocalBridgeConnection = () => undefined;
    const fileCacheRestoreController = new AbortController();
    // 检查是否为嵌入模式（最高优先级）
    const embedEnvironment = isEmbedEnvironment();
    if (embedEnvironment) {
      console.log("[App] Embed mode detected");

      useTermsStore.getState().closeModal();
      useNewcomerStore.getState().closeModal();
    } else if (isPreviewMode) {
      console.log("[App] Preview mode detected");
      useNewcomerStore.getState().closeModal();
    }

    const unsubscribeConfigCache = initializeConfigCache();

    if (embedEnvironment) {
      const disposeEmbedProtocol = registerEmbedProtocol();
      void finishBootScreenWhenReady({
        detail: "正在呈现嵌入式编辑器",
      });
      return () => {
        disposed = true;
        fileCacheRestoreController.abort();
        unsubscribeConfigCache();
        disposeEmbedProtocol();
      };
    }

    // 检查是否有分享链接参数
    const hasShareParam = !!getShareParam();

    // 检查是否有导入请求
    const { hasPending, startIn, expectedFile } = checkPendingImport();

    let startupContentTask: Promise<
      "history" | "shared" | "workspace"
    >;

    // 读取本地存储
    if (!hasShareParam && !hasPending) {
      updateBootScreen({
        detail: "正在恢复上次编辑内容",
        progress: 72,
      });
      startupContentTask = (async () => {
        let restored = false;
        try {
          restored = await restoreFileCache(
            fileCacheRestoreController.signal,
          );
        } catch (error) {
          console.error("[App] Failed to restore local file cache:", error);
        }

        if (!disposed) {
          if (restored) message.success("已读取本地缓存");
          disposeFileCache = initializeFileCachePersistence();
        }
        return restored ? "history" : "workspace";
      })();
    } else {
      disposeFileCache = initializeFileCachePersistence();
      if (hasShareParam) {
        updateBootScreen({ detail: "正在载入分享画布", progress: 72 });
        startupContentTask = loadFromShareUrl().then(() => "shared");
      } else {
        updateBootScreen({
          detail: "正在准备编辑器工作区",
          progress: 82,
        });
        startupContentTask = Promise.resolve("workspace");
      }
    }

    void startupContentTask.then(
      (content) => {
        if (disposed) return;
        const detail =
          content === "history"
            ? "正在呈现上次编辑画布"
            : content === "shared"
              ? "正在呈现分享画布"
              : "正在呈现编辑器工作区";
        void finishBootScreenWhenReady({ detail });
      },
      (error) => {
        console.error("[App] Failed to prepare startup content:", error);
        if (!disposed) {
          void finishBootScreenWhenReady({
            detail: "正在呈现编辑器工作区",
          });
        }
      },
    );

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

    disposeLocalBridgeConnection = initializeLocalBridgeConnectionState();

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
    } else if (!isPreviewMode && !isNewcomerPassed()) {
      // 协议已接受，检测新手引导
      useNewcomerStore.getState().openModal();
    }

    // 监听协议接受事件，接受后再触发新手引导检测
    const handleTermsAccepted = () => {
      if (!isPreviewMode && !isNewcomerPassed()) {
        useNewcomerStore.getState().openModal();
      }
    };
    window.addEventListener("mpe:terms-accepted", handleTermsAccepted);

    // 文件拖拽监听
    document.addEventListener("drop", handleFileDrop);
    document.addEventListener("dragover", handleDragOver);

    // 清理监听器
    return () => {
      disposed = true;
      fileCacheRestoreController.abort();
      disposeFileCache();
      disposeLocalBridgeConnection();
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
              <OptionalFeatureHosts
                allowAIHistory={showPanel("ai-history")}
                allowBusinessArchitecture={showPanel("business-architecture")}
              />
              {showPanel("json") && (
                <LazyFeature
                  loader={loadJsonViewer}
                  loadingLabel="正在加载 JSON 预览功能包"
                />
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
      <DebugRuntimeHost />
      <GlobalProcessOverlay />
      {!isEmbed && <TermsAgreementModal />}
      {!shouldSkipNewcomerGuide && <NewcomerGuideModal />}
    </ThemeProvider>
  );
}

export default App;
