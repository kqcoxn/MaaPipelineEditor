import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, List, Select, Space, Tag, Typography } from "antd";
import { DebugSection } from "../DebugSection";
import { DebugArtifactPreview } from "../DebugArtifactPreview";
import type { DebugModalController } from "../../hooks/useDebugModalController";

const { Text } = Typography;

type ArtifactStatusFilter = "all" | "idle" | "loading" | "ready" | "error";
type ArtifactContentFilter = "all" | "images" | "non-images";

export function ImagesPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    artifacts,
    requestArtifact,
    selectedArtifact,
  } = controller;
  const entries = Object.values(artifacts);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [pendingPreviewArtifactId, setPendingPreviewArtifactId] =
    useState<string>();
  const [artifactSearchText, setArtifactSearchText] = useState("");
  const [artifactStatusFilter, setArtifactStatusFilter] =
    useState<ArtifactStatusFilter>("all");
  const [artifactTypeFilter, setArtifactTypeFilter] = useState<string>("all");
  const [artifactContentFilter, setArtifactContentFilter] =
    useState<ArtifactContentFilter>("all");
  const artifactTypeOptions = useMemo(
    () => [
      { value: "all", label: "全部类型" },
      ...[...new Set(entries.map((entry) => entry.ref.type))]
        .sort((a, b) => a.localeCompare(b))
        .map((type) => ({ value: type, label: type })),
    ],
    [entries],
  );
  const filteredEntries = useMemo(() => {
    const search = artifactSearchText.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (
        artifactStatusFilter !== "all" &&
        entry.status !== artifactStatusFilter
      ) {
        return false;
      }
      if (artifactTypeFilter !== "all" && entry.ref.type !== artifactTypeFilter) {
        return false;
      }
      const isImage = entry.ref.mime.startsWith("image/");
      if (artifactContentFilter === "images" && !isImage) return false;
      if (artifactContentFilter === "non-images" && isImage) return false;
      if (!search) return true;
      return [
        entry.ref.id,
        entry.ref.type,
        entry.ref.mime,
        entry.ref.eventSeq !== undefined ? String(entry.ref.eventSeq) : "",
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search);
    });
  }, [
    artifactContentFilter,
    artifactSearchText,
    artifactStatusFilter,
    artifactTypeFilter,
    entries,
  ]);

  useEffect(() => {
    if (!pendingPreviewArtifactId) return;
    if (selectedArtifact?.ref.id !== pendingPreviewArtifactId) return;
    if (selectedArtifact.status !== "ready") return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setPendingPreviewArtifactId(undefined);
  }, [pendingPreviewArtifactId, selectedArtifact]);

  const handleRequestArtifact = (artifactId: string) => {
    requestArtifact(artifactId);
    setPendingPreviewArtifactId(artifactId);
  };

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="图片检查台（Artifacts）">
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="搜索 artifact id / type / mime / seq"
              style={{ width: 280 }}
              value={artifactSearchText}
              onChange={(event) => setArtifactSearchText(event.target.value)}
            />
            <Select
              style={{ width: 180 }}
              value={artifactContentFilter}
              options={[
                { value: "all", label: "全部内容" },
                { value: "images", label: "仅图片" },
                { value: "non-images", label: "非图片" },
              ]}
              onChange={setArtifactContentFilter}
            />
            <Select
              style={{ width: 180 }}
              value={artifactStatusFilter}
              options={[
                { value: "all", label: "全部状态" },
                { value: "idle", label: "未加载" },
                { value: "loading", label: "加载中" },
                { value: "ready", label: "已加载" },
                { value: "error", label: "错误" },
              ]}
              onChange={setArtifactStatusFilter}
            />
            <Select
              showSearch
              style={{ width: 220 }}
              value={artifactTypeFilter}
              options={artifactTypeOptions}
              onChange={setArtifactTypeFilter}
            />
            <Tag>
              {filteredEntries.length} / {entries.length}
            </Tag>
          </Space>
          <List
            bordered
            size="small"
            dataSource={filteredEntries}
            locale={{ emptyText: "暂无匹配的产物（Artifact）" }}
            renderItem={(entry) => (
              <List.Item
                actions={[
                  <Button
                    key="load"
                    size="small"
                    onClick={() => handleRequestArtifact(entry.ref.id)}
                  >
                    {entry.status === "ready" ? "查看" : "加载"}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text>{entry.ref.type}</Text>
                      <Tag>{entry.status}</Tag>
                      {entry.ref.mime.startsWith("image/") && (
                        <Tag color="cyan">图片</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text code>{entry.ref.id}</Text>
                      <Space wrap size={4}>
                        <Tag>{entry.ref.mime}</Tag>
                        <Tag>seq {entry.ref.eventSeq ?? "-"}</Tag>
                        {entry.ref.size !== undefined && (
                          <Tag>{entry.ref.size} bytes</Tag>
                        )}
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Space>
      </DebugSection>
      {selectedArtifact && (
        <div ref={previewRef}>
          <DebugSection title="产物预览（Artifact Preview）">
            <DebugArtifactPreview artifact={selectedArtifact} />
          </DebugSection>
        </div>
      )}
    </Space>
  );
}
