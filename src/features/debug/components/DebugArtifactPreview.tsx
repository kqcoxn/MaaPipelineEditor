import { useState, type CSSProperties } from "react";
import { Alert, Spin, Typography } from "antd";
import type { DebugArtifactEntry } from "../../../stores/debugArtifactStore";
import {
  normalizeDebugArtifactBox,
  type DebugArtifactBox,
} from "../artifactDetailSummary";

const { Text } = Typography;

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 280,
  overflow: "auto",
};

export interface DebugArtifactPreviewProps {
  artifact?: DebugArtifactEntry;
  box?: unknown;
  maxImageHeight?: number;
}

export function DebugArtifactPreview({
  artifact,
  box,
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
      <DebugImagePreview
        alt={payload.ref.type}
        box={normalizeDebugArtifactBox(box)}
        maxImageHeight={maxImageHeight}
        src={`data:${payload.ref.mime};base64,${payload.content}`}
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

function DebugImagePreview({
  alt,
  box,
  maxImageHeight,
  src,
}: {
  alt: string;
  box?: DebugArtifactBox;
  maxImageHeight: number;
  src: string;
}) {
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  }>();
  const boxStyle =
    box && naturalSize
      ? normalizeBoxStyle(box, naturalSize.width, naturalSize.height)
      : undefined;

  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: "100%",
        position: "relative",
      }}
    >
      <img
        alt={alt}
        src={src}
        style={{
          display: "block",
          maxWidth: "100%",
          maxHeight: maxImageHeight,
        }}
        onLoad={(event) => {
          setNaturalSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
      />
      {boxStyle && (
        <span
          aria-hidden
          style={{
            ...boxStyle,
            border: "2px solid #13c2c2",
            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.32)",
            boxSizing: "border-box",
            pointerEvents: "none",
            position: "absolute",
          }}
        />
      )}
    </span>
  );
}

function normalizeBoxStyle(
  box: DebugArtifactBox,
  naturalWidth: number,
  naturalHeight: number,
): CSSProperties | undefined {
  if (naturalWidth <= 0 || naturalHeight <= 0) return undefined;
  const left = clampPercent((box.x / naturalWidth) * 100);
  const top = clampPercent((box.y / naturalHeight) * 100);
  const right = clampPercent(((box.x + box.width) / naturalWidth) * 100);
  const bottom = clampPercent(((box.y + box.height) / naturalHeight) * 100);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (width <= 0 || height <= 0) return undefined;
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
