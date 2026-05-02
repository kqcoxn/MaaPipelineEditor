import style from "./styles/layout/App.module.less";

import { memo, useCallback, useEffect, useState } from "react";
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
import { saveConfigCache, useConfigStore } from "./stores/configStore";
import { useWSStore } from "./stores/wsStore";
import { useMFWStore } from "./stores/mfwStore";
import { useCustomTemplateStore } from "./stores/customTemplateStore";
import { localServer } from "./services/server";

import Header from "./components/Header";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import MainFlow from "./components/Flow";
import JsonViewer from "./components/JsonViewer";
import FieldPanel from "./components/panels/main/FieldPanel";
import EdgePanel from "./components/panels/main/EdgePanel";
import LiveScreenPanel from "./components/panels/main/LiveScreenPanel";
import ToolPanel from "./components/panels/tools/ToolPanel";
import SearchPanel from "./components/panels/main/SearchPanel";
import FilePanel from "./components/panels/main/FilePanel";
import SettingsPanel from "./components/panels/settings/SettingsPanel";
import FileConfigPanel from "./components/panels/main/FileConfigPanel";
import AIHistoryPanel from "./components/panels/main/AIHistoryPanel";
import { LocalFileListPanel } from "./components/panels/main/LocalFileListPanel";
import ErrorPanel from "./components/panels/main/ErrorPanel";
import ToolbarPanel from "./components/panels/main/ToolbarPanel";
import { LoggerPanel } from "./components/panels/tools/LoggerPanel";
import { DebugModal } from "./components/debug/DebugModal";
import { WikiModal } from "./features/wiki/components/WikiModal";
import {
  ExplorationFAB,
  ExplorationPanel,
} from "./components/panels/exploration";
import { pipelineToFlow, flowToPipelineString } from "./core/parser";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  getShareParam,
  loadFromShareUrl,
  checkPendingImport,
  handleImportFromUrl,
  clearImportParam,
} from "./utils/data/shareHelper";
import { parseUrlParams } from "./utils/data/urlHelper";
import { useWikiStore } from "./stores/wikiStore";
import { clearWikiHashParam, readWikiTargetFromHash } from "./wiki/wikiUrl";
import {
  isWailsEnvironment,
  onWailsEvent,
  getWailsPort,
  isBridgeRunning,
  wailsLog,
} from "./utils/wailsBridge";
import {
  isEmbedEnvironment,
  initEmbedBridge,
  onParentMessage,
  sendToParent,
  completeHandshake,
  type EmbedCapabilities,
  type EmbedUIConfig,
} from "./utils/embedBridge";
import { useEmbedStore } from "./stores/embedStore";
import { useEmbedMode } from "./hooks/useEmbedMode";
import { useEmbedChangeNotifier } from "./hooks/useEmbedChangeNotifier";
import { useFlowStore } from "./stores/flow";

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
  // 嵌入模式状态
  const { isEmbed, isReady, isCapAllowed, isPanelHidden } = useEmbedMode();

  // 探索面板状态
  const [explorationPanelVisible, setExplorationPanelVisible] = useState(false);

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

  // onMounted
  useEffect(() => {
    // 检查是否为嵌入模式（最高优先级）
    if (isEmbedEnvironment()) {
      console.log("[App] Embed mode detected");

      // 初始化 EmbedBridge
      const { cleanup: cleanupEmbedBridge } = initEmbedBridge();

      // 注册业务消息处理器
      const cleanupInit = onParentMessage("mpe:init", (payload, requestId) => {
        const config = payload as {
          capabilities?: Partial<EmbedCapabilities>;
          ui?: Partial<EmbedUIConfig>;
        };
        useEmbedStore
          .getState()
          .initConfig(config.capabilities || {}, config.ui || {});
        useEmbedStore.getState().setReady(true);
        completeHandshake(
          useEmbedStore.getState().capabilities,
          useEmbedStore.getState().ui,
          requestId,
        );
      });

      const cleanupLoad = onParentMessage(
        "mpe:loadPipeline",
        async (payload, requestId) => {
          const { fileName, data } = payload as {
            fileName?: string;
            data: unknown;
          };
          try {
            const success = await pipelineToFlow({
              pString: JSON.stringify(data),
            });
            if (success && fileName) {
              useFileStore.getState().setFileName(fileName);
              useEmbedStore.getState().setFileName(fileName);
            }
            sendToParent("mpe:loadResult", { success, fileName }, requestId);
          } catch (err) {
            sendToParent(
              "mpe:loadResult",
              {
                success: false,
                error: err instanceof Error ? err.message : String(err),
              },
              requestId,
            );
          }
        },
      );

      const cleanupSave = onParentMessage("mpe:save", (_payload, requestId) => {
        try {
          const pipelineObj = flowToPipelineString();
          const fileName = useFileStore.getState().currentFile.fileName;
          sendToParent(
            "mpe:saveData",
            { fileName, data: pipelineObj },
            requestId,
          );
        } catch (err) {
          sendToParent(
            "mpe:error",
            {
              code: "save_failed",
              message: err instanceof Error ? err.message : String(err),
            },
            requestId,
          );
        }
      });

      const cleanupSelect = onParentMessage("mpe:selectNode", (payload) => {
        const { nodeId } = payload as { nodeId: string };
        const { nodes, updateNodes } = useFlowStore.getState();
        // 先按 ID 查找，找不到则按标签回退
        const targetNode =
          nodes.find((n) => n.id === nodeId) ||
          nodes.find((n) => n.data?.label === nodeId);
        if (targetNode) {
          updateNodes(
            nodes.map((n) => ({
              type: "select" as const,
              id: n.id,
              selected: n.id === targetNode.id,
            })),
          );
        } else {
          sendToParent("mpe:error", {
            code: "node_not_found",
            message: `Node not found: ${nodeId}`,
          });
        }
      });

      const cleanupFocus = onParentMessage("mpe:focusNode", (payload) => {
        const { nodeId } = payload as { nodeId: string };
        const { nodes, instance } = useFlowStore.getState();
        // 先按 ID 查找，找不到则按标签回退
        const targetNode =
          nodes.find((n) => n.id === nodeId) ||
          nodes.find((n) => n.data?.label === nodeId);
        if (targetNode && instance) {
          instance.fitView({
            nodes: [{ id: targetNode.id }],
            duration: 300,
          });
        } else if (!targetNode) {
          sendToParent("mpe:error", {
            code: "node_not_found",
            message: `Node not found: ${nodeId}`,
          });
        }
      });

      const cleanupState = onParentMessage(
        "mpe:state",
        (payload, requestId) => {
          const { fields } = payload as { fields: string[] };
          const result: Record<string, unknown> = {};
          const state = useFlowStore.getState();
          fields.forEach((field) => {
            switch (field) {
              case "version":
                result[field] = "1.0.0";
                break;
              case "nodesCount":
                result[field] = state.nodes.length;
                break;
              case "edgesCount":
                result[field] = state.edges.length;
                break;
              case "fileName":
                result[field] = useFileStore.getState().currentFile.fileName;
                break;
              case "readOnly":
                result[field] = useEmbedStore.getState().capabilities.readOnly;
                break;
              default:
                result[field] = undefined;
            }
          });
          sendToParent("mpe:stateResult", result, requestId);
        },
      );

      // 嵌入模式下监听 Ctrl+S 发送 saveRequest
      const handleSaveRequest = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          sendToParent("mpe:saveRequest", { hint: "user-triggered" });
        }
      };
      document.addEventListener("keydown", handleSaveRequest);

      return () => {
        cleanupEmbedBridge();
        cleanupInit();
        cleanupLoad();
        cleanupSave();
        cleanupSelect();
        cleanupFocus();
        cleanupState();
        document.removeEventListener("keydown", handleSaveRequest);
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

    const unsubscribeConfigCache = useConfigStore.subscribe(
      (state, prevState) => {
        if (
          state.configs !== prevState.configs ||
          state.configuredKeys !== prevState.configuredKeys
        ) {
          try {
            saveConfigCache();
          } catch (error) {
            console.error("[App] 保存配置缓存失败:", error);
          }
        }
      },
    );

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
    const wikiTarget = readWikiTargetFromHash();
    if (wikiTarget) {
      useWikiStore.getState().openWiki(wikiTarget);
      clearWikiHashParam();
    }

    // Wails 环境下的连接逻辑
    let cleanupWailsListener: (() => void) | null = null;

    if (isWailsEnvironment()) {
      wailsLog("[Frontend] Wails environment detected");

      let connectionInitiated = false;

      // 监听后端发送的端口事件
      cleanupWailsListener = onWailsEvent<number>("bridge:port", (port) => {
        if (connectionInitiated) {
          return;
        }
        connectionInitiated = true;
        wailsLog(`[Frontend] Received port: ${port}`);
        localServer.setPort(port);
        localServer.connect();
      });

      // 尝试直接获取端口
      getWailsPort().then(async (port) => {
        if (connectionInitiated) {
          return;
        }
        if (
          port &&
          !localServer.isConnected() &&
          !localServer.getIsConnecting()
        ) {
          // 检查 bridge 是否已经就绪
          const running = await isBridgeRunning();
          // 防止在 await 期间事件已经触发了连接
          if (running && !connectionInitiated) {
            connectionInitiated = true;
            wailsLog(`[Frontend] Got port from GetPort: ${port}`);
            localServer.setPort(port);
            localServer.connect();
          } else {
            wailsLog(
              "[Frontend] Bridge not ready or connection initiated, waiting for event",
            );
          }
        }
      });
    } else {
      // 非 Wails 环境：使用 URL 参数或配置
      // 确定使用的端口：URL参数 > 配置端口 > 默认端口
      const targetPort = urlParams.port || configuredPort;
      if (targetPort) {
        localServer.setPort(targetPort);
      }

      // 自动连接或者 URL 参数连接
      if (wsAutoConnect || urlParams.linkLb) {
        localServer.connect();
      }
    }

    // Star定时提醒
    if (localStorage.getItem("_mpe_stared") !== "true") {
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
      document.removeEventListener("drop", handleFileDrop);
      document.removeEventListener("dragover", handleDragOver);
      // 清理 Wails 事件监听
      if (cleanupWailsListener) {
        cleanupWailsListener();
      }
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
              {showPanel("json") && <JsonViewer />}
              {showPanel("liveScreen") && <LiveScreenPanel />}
              {showPanel("field") && <FieldPanel />}
              {showPanel("edge") && <EdgePanel />}
              {showPanel("config") && <SettingsPanel />}
              {showPanel("config") && <FileConfigPanel />}
              {showPanel("ai-history") && <AIHistoryPanel />}
              {showPanel("local-file") && <LocalFileListPanel />}
              <ToolPanel.Add />
              <ToolPanel.Global />
              {showPanel("search") && <SearchPanel />}
              <ToolPanel.Layout />
              {showPanel("error") && <ErrorPanel />}
              {showPanel("logger") && <LoggerPanel />}
              {/* 探索模式组件 */}
              {showPanel("exploration") && (
                <>
                  <ExplorationFAB
                    onClick={() => setExplorationPanelVisible((v) => !v)}
                    visible={true}
                    active={explorationPanelVisible}
                  />
                  <ExplorationPanel
                    visible={explorationPanelVisible}
                    onClose={() => setExplorationPanelVisible(false)}
                  />
                </>
              )}
            </div>
          </Content>
        </Layout>
      </Flex>
      <DebugModal />
      <WikiModal />
      <GlobalListener />
    </ThemeProvider>
  );
}

export default App;
