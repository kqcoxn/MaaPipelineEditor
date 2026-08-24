import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Empty,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { CSSProperties } from "react";
import { DebugSection } from "../DebugSection";
import { mfwProtocol } from "../../../../services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import { MaaLogAnalyzerIntro } from "../MaaLogAnalyzerIntro";

const { Text } = Typography;

const logViewerStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  maxHeight: "calc(100vh - 360px)",
  minHeight: 200,
  overflow: "auto",
  background: "#1e1e1e",
  color: "#d4d4d4",
  borderRadius: 6,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  userSelect: "text",
};

interface MaafwLogState {
  status: "idle" | "loading" | "loaded" | "error";
  content: string;
  path?: string;
  dir?: string;
  size?: number;
  truncated?: boolean;
  modTime?: string;
  message?: string;
  exists: boolean;
}

const INITIAL_STATE: MaafwLogState = {
  status: "idle",
  content: "",
  exists: false,
};

function formatSize(size?: number): string {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function DebugLogPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  void controller;
  const { message } = AntdApp.useApp();
  const connected = useWSStore((state) => state.connected);
  const [logState, setLogState] = useState<MaafwLogState>(INITIAL_STATE);
  const [exporting, setExporting] = useState(false);
  const viewerRef = useRef<HTMLPreElement>(null);

  const refreshLog = useCallback(() => {
    if (!connected) {
      message.warning("未连接本地服务，无法读取 maafw.log");
      return;
    }
    setLogState((prev) => ({ ...prev, status: "loading" }));
    const sent = mfwProtocol.requestMaafwLogContent();
    if (!sent) {
      setLogState((prev) => ({
        ...prev,
        status: "error",
        message: "发送读取 maafw.log 请求失败",
      }));
    }
  }, [connected, message]);

  useEffect(() => {
    const unsubscribeContent = mfwProtocol.onMaafwLogContent((data) => {
      if (!data.success) {
        setLogState({
          status: "error",
          content: "",
          exists: data.exists ?? false,
          dir: data.dir,
          path: data.path,
          message: data.message ?? "读取 maafw.log 失败",
        });
        return;
      }
      setLogState({
        status: "loaded",
        content: data.content ?? "",
        exists: true,
        dir: data.dir,
        path: data.path,
        size: data.size,
        truncated: data.truncated,
        modTime: data.modTime,
        message: undefined,
      });
    });
    const unsubscribeOpened = mfwProtocol.onMaafwLogOpened((data) => {
      if (data.success) {
        message.success(data.message);
      } else {
        message.error(data.message);
      }
    });
    const unsubscribeExported = mfwProtocol.onMFWLogsExported((data) => {
      setExporting(false);
      if (!data.success || !data.content) {
        message.error(data.message ?? "MFW 日志打包失败");
        return;
      }

      const binary = atob(data.content);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.filename ?? "mfw-logs.zip";
      anchor.click();
      URL.revokeObjectURL(url);
      message.success(data.message ?? "MFW 日志打包成功");
    });
    return () => {
      unsubscribeContent();
      unsubscribeOpened();
      unsubscribeExported();
    };
  }, [message]);

  // 面板首次挂载且已连接时自动读取
  useEffect(() => {
    if (connected && logState.status === "idle") {
      refreshLog();
    }
  }, [connected, logState.status, refreshLog]);

  // 内容更新后滚动到底部
  useEffect(() => {
    if (logState.status === "loaded" && viewerRef.current) {
      viewerRef.current.scrollTop = viewerRef.current.scrollHeight;
    }
  }, [logState.status, logState.content]);

  const openDir = () => {
    if (!connected) {
      message.warning("未连接本地服务");
      return;
    }
    if (!mfwProtocol.requestOpenMaafwLogDir()) {
      message.error("发送打开 maafw.log 目录请求失败");
    }
  };

  const exportMFWLogs = () => {
    if (!connected) {
      message.warning("未连接本地服务");
      return;
    }
    setExporting(true);
    if (!mfwProtocol.requestExportMFWLogs()) {
      setExporting(false);
      message.error("发送 MFW 日志打包请求失败");
    }
  };

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="关于调试日志">
        <MaaLogAnalyzerIntro />
      </DebugSection>
      {logState.status === "error" && (
        <Alert
          type="error"
          showIcon
          title="读取 maafw.log 失败"
          description={logState.message}
        />
      )}
      <DebugSection title="调试日志（maafw.log）">
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              loading={logState.status === "loading"}
              onClick={refreshLog}
            >
              刷新
            </Button>
            <Button icon={<FolderOpenOutlined />} onClick={openDir}>
              打开所在文件夹
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={exportMFWLogs}
            >
              一键打包 MFW 日志
            </Button>
            {logState.status === "loaded" && logState.content && (
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(logState.content).then(
                    () => message.success("已复制日志全文"),
                    () => message.error("复制失败"),
                  );
                }}
              >
                复制全文
              </Button>
            )}
            {logState.truncated && <Tag color="orange">仅显示末尾片段</Tag>}
            {logState.size !== undefined && (
              <Tag>{formatSize(logState.size)}</Tag>
            )}
            {logState.modTime && (
              <Text type="secondary">更新于 {logState.modTime}</Text>
            )}
          </Space>
          {logState.path && (
            <Text type="secondary" style={{ wordBreak: "break-all" }}>
              {logState.path}
            </Text>
          )}
          {logState.status === "loaded" && logState.content ? (
            <pre ref={viewerRef} style={logViewerStyle}>
              {logState.content}
            </pre>
          ) : logState.status === "loaded" ? (
            <Empty description="maafw.log 内容为空" />
          ) : logState.status === "error" && !logState.exists ? (
            <Empty description="maafw.log 不存在，执行一次调试任务后再试" />
          ) : (
            <Empty description="点击刷新读取 maafw.log" />
          )}
        </Space>
      </DebugSection>
    </Space>
  );
}
