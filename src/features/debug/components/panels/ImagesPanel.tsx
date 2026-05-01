import { useMemo, useState } from "react";
import { Button, Input, List, Select, Space, Tag, Typography } from "antd";
import {
  CaretRightOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
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
    startScreenshotStream,
    mfwState,
    screenshotStream,
    stopScreenshotStream,
    profileState,
    requestImageList,
    imageListLoading,
    imageListBundleName,
    imageList,
    requestArtifact,
    startBatchRecognition,
    debugReadiness,
    selectedNodeId,
    stopBatchRecognition,
    selectedArtifact,
  } = controller;
  const entries = Object.values(artifacts);
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

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="实时截图（Live Screenshot）">
        <Space wrap>
          <Button
            icon={<CaretRightOutlined />}
            onClick={startScreenshotStream}
            disabled={!mfwState.controllerId || screenshotStream?.active}
          >
            开始推流
          </Button>
          <Button
            danger
            icon={<StopOutlined />}
            onClick={stopScreenshotStream}
            disabled={!screenshotStream?.active}
          >
            停止推流
          </Button>
          <Tag color={screenshotStream?.active ? "green" : "default"}>
            {screenshotStream?.active ? "推流中" : "已停止"}
          </Tag>
          <Tag>间隔 {profileState.screenshotStreamConfig.intervalMs}ms</Tag>
          <Tag>帧数 {screenshotStream?.frameCount ?? 0}</Tag>
        </Space>
      </DebugSection>
      <DebugSection title="固定图输入">
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={requestImageList}
              loading={imageListLoading}
            >
              刷新资源（Resource）图片
            </Button>
            <Tag>{imageListBundleName || "全部资源"}</Tag>
          </Space>
          <Select
            allowClear
            showSearch
            loading={imageListLoading}
            style={{ width: "100%" }}
            value={profileState.fixedImageInput.imageRelativePath}
            placeholder="选择资源 image 目录下的相对路径（resource/image）"
            onChange={(imageRelativePath) =>
              profileState.setFixedImageInput({
                ...profileState.fixedImageInput,
                imageRelativePath,
              })
            }
            options={imageList.map((image) => ({
              value: image.relativePath,
              label: image.bundleName
                ? `${image.relativePath} · ${image.bundleName}`
                : image.relativePath,
            }))}
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            loading={imageListLoading}
            style={{ width: "100%" }}
            value={profileState.batchRecognitionImages
              .map((image) => image.imageRelativePath)
              .filter((path): path is string => Boolean(path))}
            placeholder="选择批量识别图片；留空时使用前 50 张"
            onChange={(values) =>
              profileState.setBatchRecognitionImages(
                values.map((imageRelativePath) => ({ imageRelativePath })),
              )
            }
            options={imageList.map((image) => ({
              value: image.relativePath,
              label: image.bundleName
                ? `${image.relativePath} · ${image.bundleName}`
                : image.relativePath,
            }))}
          />
          <Input
            value={profileState.fixedImageInput.imagePath}
            onChange={(event) =>
              profileState.setFixedImageInput({
                ...profileState.fixedImageInput,
                imagePath: event.target.value,
              })
            }
            addonBefore="图片路径"
            placeholder="项目根或资源（Resource）路径内的图片文件"
          />
        </Space>
      </DebugSection>
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
                    onClick={() => requestArtifact(entry.ref.id)}
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
      <DebugSection title="批量固定图识别">
        <Space wrap>
          <Button
            type="primary"
            icon={<FileSearchOutlined />}
            onClick={startBatchRecognition}
            disabled={
              !debugReadiness.ready || !selectedNodeId || imageList.length === 0
            }
          >
            批量识别前 50 张
          </Button>
          <Button danger icon={<StopOutlined />} onClick={stopBatchRecognition}>
            停止批量
          </Button>
          <Tag>图片 {imageList.length}</Tag>
          <Tag>
            已选 {profileState.batchRecognitionImages.length || "前 50 张"}
          </Tag>
          <Tag>目标 {selectedNodeId ?? "-"}</Tag>
        </Space>
      </DebugSection>
      {selectedArtifact && (
        <DebugSection title="产物预览（Artifact Preview）">
          <DebugArtifactPreview artifact={selectedArtifact} />
        </DebugSection>
      )}
    </Space>
  );
}
