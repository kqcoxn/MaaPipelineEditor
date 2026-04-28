import { Alert, Button, Input, List, Select, Space, Tag, Typography } from "antd";
import {
  CaretRightOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";

const { Text } = Typography;

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
      <List
        bordered
        size="small"
        dataSource={entries}
        locale={{ emptyText: "暂无产物（Artifact）" }}
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
                <Space>
                  <Text>{entry.ref.type}</Text>
                  <Tag>{entry.status}</Tag>
                </Space>
              }
              description={`${entry.ref.id} · seq ${entry.ref.eventSeq ?? "-"}`}
            />
          </List.Item>
        )}
      />
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
          {selectedArtifact.error && (
            <Alert type="error" showIcon message={selectedArtifact.error} />
          )}
          {selectedArtifact.payload?.content &&
            selectedArtifact.payload.ref.mime.startsWith("image/") && (
              <img
                alt={selectedArtifact.payload.ref.type}
                src={`data:${selectedArtifact.payload.ref.mime};base64,${selectedArtifact.payload.content}`}
                style={{ maxWidth: "100%", maxHeight: 360 }}
              />
            )}
          {selectedArtifact.payload?.data !== undefined && (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {JSON.stringify(selectedArtifact.payload.data, null, 2)}
            </pre>
          )}
          {selectedArtifact.payload?.content &&
            !selectedArtifact.payload.ref.mime.startsWith("image/") && (
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {selectedArtifact.payload.content}
              </pre>
            )}
        </DebugSection>
      )}
    </Space>
  );
}
