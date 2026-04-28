import { Button, Empty, List, Space, Tag, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";

const { Text, Title } = Typography;

export function NodesPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    selectedNodeDetail,
    selectedNodeId,
    events,
    selectedNodeReplays,
    requestArtifact,
    pipelineNodes,
    selectNode,
    setLastEntryNodeId,
    profileState,
    startRun,
    debugReadiness,
    availableModeIds,
    confirmActionRun,
  } = controller;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      {selectedNodeDetail && (
        <section>
          <Title level={5} style={{ marginTop: 0 }}>
            目标节点详情
          </Title>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Space wrap>
              <Tag>{selectedNodeDetail.label ?? selectedNodeId}</Tag>
              <Tag>
                追踪{" "}
                {
                  events.filter(
                    (event) => event.node?.nodeId === selectedNodeId,
                  ).length
                }
              </Tag>
              <Tag>运行 {selectedNodeReplays.length}</Tag>
            </Space>
            <DebugSection title="会话回放（Session Replay）">
              {selectedNodeReplays.length === 0 ? (
                <Empty description="当前会话（Session）中暂无该节点运行事件" />
              ) : (
                <List
                  size="small"
                  dataSource={selectedNodeReplays}
                  renderItem={(replay) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Space wrap>
                          <Tag
                            color={replay.status === "failed" ? "red" : "blue"}
                          >
                            {replay.status}
                          </Tag>
                          <Tag>运行 {replay.runId || "-"}</Tag>
                          <Tag>
                            seq {replay.firstSeq}-{replay.lastSeq}
                          </Tag>
                          <Tag>识别 {replay.recognitionEvents.length}</Tag>
                          <Tag>动作 {replay.actionEvents.length}</Tag>
                          <Tag>候选列表 {replay.nextListEvents.length}</Tag>
                          <Tag>等待静止 {replay.waitFreezesEvents.length}</Tag>
                        </Space>
                        <Space wrap>
                          {replay.detailRefs.map((ref) => (
                            <Button
                              key={ref}
                              size="small"
                              onClick={() => requestArtifact(ref)}
                            >
                              详情 #{ref.slice(0, 8)}
                            </Button>
                          ))}
                          {replay.screenshotRefs.map((ref) => (
                            <Button
                              key={ref}
                              size="small"
                              icon={<PictureOutlined />}
                              onClick={() => requestArtifact(ref)}
                            >
                              图像 #{ref.slice(0, 8)}
                            </Button>
                          ))}
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </DebugSection>
            <DebugSection title="静态节点配置">
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(
                  {
                    recognition: selectedNodeDetail.recognition,
                    action: selectedNodeDetail.action,
                    next: selectedNodeDetail.others?.next,
                    on_error: selectedNodeDetail.others?.on_error,
                    waitFreezes: {
                      pre: selectedNodeDetail.others?.pre_wait_freezes,
                      post: selectedNodeDetail.others?.post_wait_freezes,
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </DebugSection>
          </Space>
        </section>
      )}
      <List
        bordered
        dataSource={pipelineNodes}
        locale={{ emptyText: "当前图没有可调试 Pipeline 节点" }}
        renderItem={(node) => {
          const active = selectedNodeId === node.nodeId;
          return (
            <List.Item
              actions={[
                <Button
                  key="select"
                  size="small"
                  onClick={() => {
                    selectNode(node.nodeId);
                    setLastEntryNodeId(node.nodeId);
                    profileState.setEntry({
                      fileId: node.fileId,
                      nodeId: node.nodeId,
                      runtimeName: node.runtimeName,
                    });
                  }}
                >
                  设为入口
                </Button>,
                <Button
                  key="run"
                  size="small"
                  type="primary"
                  onClick={() => startRun("run-from-node", node.nodeId)}
                  disabled={
                    !debugReadiness.ready ||
                    !availableModeIds.has("run-from-node")
                  }
                >
                  从此运行
                </Button>,
                <Button
                  key="single"
                  size="small"
                  onClick={() => startRun("single-node-run", node.nodeId)}
                  disabled={
                    !debugReadiness.ready ||
                    !availableModeIds.has("single-node-run")
                  }
                >
                  单节点
                </Button>,
                <Button
                  key="recognition"
                  size="small"
                  onClick={() => startRun("recognition-only", node.nodeId)}
                  disabled={
                    !debugReadiness.ready ||
                    !availableModeIds.has("recognition-only")
                  }
                >
                  识别
                </Button>,
                <Button
                  key="action"
                  size="small"
                  danger
                  onClick={() => confirmActionRun(node.nodeId)}
                  disabled={
                    !debugReadiness.ready || !availableModeIds.has("action-only")
                  }
                >
                  动作
                </Button>,
                <Button
                  key="fixed-image"
                  size="small"
                  onClick={() =>
                    startRun("fixed-image-recognition", node.nodeId)
                  }
                  disabled={
                    !debugReadiness.ready ||
                    !availableModeIds.has("fixed-image-recognition")
                  }
                >
                  固定图
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong={active}>{node.displayName}</Text>
                    {active && <Tag color="blue">已选中</Tag>}
                  </Space>
                }
                description={`${node.fileId} · ${node.runtimeName}`}
              />
            </List.Item>
          );
        }}
      />
    </Space>
  );
}
