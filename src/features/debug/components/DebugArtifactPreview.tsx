import type { CSSProperties } from "react";
import { Alert, Spin, Typography } from "antd";
import type { DebugArtifactEntry } from "../../../stores/debugArtifactStore";
import { normalizeDebugArtifactBox } from "../artifactDetailSummary";
import {
  DebugImageViewer,
  type DebugImageOverlay,
  type DebugImageOverlayGroup,
} from "./DebugImageViewer";
import { DebugJsonPreview } from "./DebugJsonPreview";

const { Text } = Typography;

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 280,
  overflow: "auto",
  wordBreak: "break-word",
};

export interface DebugArtifactPreviewProps {
  artifact?: DebugArtifactEntry;
  box?: unknown;
  maxImageHeight?: number;
  overlayGroups?: DebugImageOverlayGroup[];
  overlays?: DebugImageOverlay[];
}

export function DebugArtifactPreview({
  artifact,
  box,
  maxImageHeight = 360,
  overlayGroups,
  overlays: inputOverlays,
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
    const normalizedBox = normalizeDebugArtifactBox(box);
    const overlays: DebugImageOverlay[] = inputOverlays ?? (normalizedBox
      ? [
          {
            id: `${payload.ref.id}:box`,
            kind: "box",
            box: normalizedBox,
            status: "selected",
          },
        ]
      : []);
    return (
      <DebugImageViewer
        alt={payload.ref.type}
        maxImageHeight={maxImageHeight}
        metadata={{
          artifactId: payload.ref.id,
          artifactType: payload.ref.type,
          eventSeq: payload.ref.eventSeq,
          mime: payload.ref.mime,
        }}
        overlayGroups={overlayGroups}
        overlays={overlays}
        src={`data:${payload.ref.mime};base64,${payload.content}`}
      />
    );
  }

  if (payload.data !== undefined) {
    return <DebugJsonPreview value={payload.data} />;
  }

  if (payload.content) {
    if (
      payload.ref.mime.includes("json") ||
      payload.encoding === "json" ||
      payload.encoding === "utf8"
    ) {
      return <DebugJsonPreview value={payload.content} />;
    }
    return <pre style={preStyle}>{payload.content}</pre>;
  }

  return <Text type="secondary">产物（Artifact）没有可预览内容。</Text>;
}
