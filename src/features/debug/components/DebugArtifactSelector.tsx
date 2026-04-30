import { Button, Space, Typography } from "antd";
import { DebugArtifactPreview } from "./DebugArtifactPreview";
import type { DebugArtifactEntry } from "../../../stores/debugArtifactStore";

const { Text } = Typography;

export interface DebugArtifactSelectorGroup {
  title: string;
  refs: Array<{ ref: string; label: string }>;
}

export function DebugArtifactSelector({
  box,
  emptyText = "没有可查看的 artifact 引用。",
  groups,
  requestArtifact,
  selectedArtifact,
}: {
  box?: unknown;
  emptyText?: string;
  groups: DebugArtifactSelectorGroup[];
  requestArtifact: (artifactId: string) => void;
  selectedArtifact?: DebugArtifactEntry;
}) {
  const activeRefs = new Set(
    groups.flatMap((group) => group.refs.map((item) => item.ref)),
  );
  const hasRefs = activeRefs.size > 0;
  const selectedArtifactIsRelated =
    selectedArtifact && activeRefs.has(selectedArtifact.ref.id);

  if (!hasRefs) {
    return <Text type="secondary">{emptyText}</Text>;
  }

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {groups.map((group) => (
        <ArtifactButtonGroup
          key={group.title}
          activeRef={selectedArtifact?.ref.id}
          group={group}
          requestArtifact={requestArtifact}
        />
      ))}
      {selectedArtifactIsRelated && (
        <DebugArtifactPreview artifact={selectedArtifact} box={box} />
      )}
    </Space>
  );
}

function ArtifactButtonGroup({
  activeRef,
  group,
  requestArtifact,
}: {
  activeRef?: string;
  group: DebugArtifactSelectorGroup;
  requestArtifact: (artifactId: string) => void;
}) {
  if (group.refs.length === 0) return null;

  return (
    <Space direction="vertical" size={4}>
      <Text type="secondary">{group.title}</Text>
      <Space wrap>
        {group.refs.map((item) => {
          const active = item.ref === activeRef;
          return (
            <Button
              key={`${group.title}-${item.ref}-${item.label}`}
              disabled={active}
              size="small"
              type={active ? "primary" : "default"}
              onClick={() => requestArtifact(item.ref)}
            >
              {item.label}
            </Button>
          );
        })}
      </Space>
    </Space>
  );
}
