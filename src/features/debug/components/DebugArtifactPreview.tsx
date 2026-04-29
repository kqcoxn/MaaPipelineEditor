import type { CSSProperties } from "react";
import { Alert, Spin, Typography } from "antd";
import type { DebugArtifactEntry } from "../../../stores/debugArtifactStore";

const { Text } = Typography;

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 280,
  overflow: "auto",
};

export interface DebugArtifactPreviewProps {
  artifact?: DebugArtifactEntry;
  maxImageHeight?: number;
}

export function DebugArtifactPreview({
  artifact,
  maxImageHeight = 360,
}: DebugArtifactPreviewProps) {
  if (!artifact) return null;

  if (artifact.error) {
    return <Alert type="error" showIcon message={artifact.error} />;
  }

  if (artifact.status === "loading") {
    return <Spin size="small" />;
  }

  if (!artifact.payload) {
    return <Text type="secondary">产物（Artifact）尚未加载。</Text>;
  }

  const { payload } = artifact;
  if (payload.content && payload.ref.mime.startsWith("image/")) {
    return (
      <img
        alt={payload.ref.type}
        src={`data:${payload.ref.mime};base64,${payload.content}`}
        style={{ maxWidth: "100%", maxHeight: maxImageHeight }}
      />
    );
  }

  if (payload.data !== undefined) {
    return <pre style={preStyle}>{safeStringify(payload.data)}</pre>;
  }

  if (payload.content) {
    return <pre style={preStyle}>{payload.content}</pre>;
  }

  return <Text type="secondary">产物（Artifact）没有可预览内容。</Text>;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
