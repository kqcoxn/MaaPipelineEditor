import { useMemo } from "react";
import { Select } from "antd";
import { useFlowStore } from "../../../stores/flow";
import { useShallow } from "zustand/shallow";

/**路径选择浮层内容 */
export default function PathSelector() {
  const nodes = useFlowStore((state) => state.nodes);
  const {
    pathMode,
    pathStartNodeId,
    pathEndNodeId,
    pathNodeIds,
    setPathMode,
    setPathStartNode,
    setPathEndNode,
    clearPath,
  } = useFlowStore(
    useShallow((state) => ({
      pathMode: state.pathMode,
      pathStartNodeId: state.pathStartNodeId,
      pathEndNodeId: state.pathEndNodeId,
      pathNodeIds: state.pathNodeIds,
      setPathMode: state.setPathMode,
      setPathStartNode: state.setPathStartNode,
      setPathEndNode: state.setPathEndNode,
      clearPath: state.clearPath,
    }))
  );

  // 生成节点选项
  const nodeOptions = useMemo(() => {
    return nodes.map((node) => ({
      label: node.data.label,
      value: node.id,
    }));
  }, [nodes]);

  const hasPath = pathNodeIds.size > 0;
  const noPath = pathStartNodeId && pathEndNodeId && !hasPath;

  return (
    <div style={{ width: 240, padding: "8px 0" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 4, fontSize: 12, color: "#666" }}>
          起始节点
        </div>
        <Select
          style={{ width: "100%" }}
          placeholder="选择起始节点"
          value={pathStartNodeId}
          onChange={(value) => setPathStartNode(value)}
          options={nodeOptions}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          allowClear
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 4, fontSize: 12, color: "#666" }}>
          结束节点
        </div>
        <Select
          style={{ width: "100%" }}
          placeholder="选择结束节点"
          value={pathEndNodeId}
          onChange={(value) => setPathEndNode(value)}
          options={nodeOptions}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          allowClear
        />
      </div>
      {hasPath && (
        <div style={{ fontSize: 12, color: "#52c41a", marginBottom: 8 }}>
          ✓ 找到路径，共 {pathNodeIds.size} 个节点
        </div>
      )}
      {noPath && (
        <div style={{ fontSize: 12, color: "#ff4d4f", marginBottom: 8 }}>
          ✗ 未找到路径
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{
            flex: 1,
            padding: "4px 8px",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
          }}
          onClick={() => clearPath()}
        >
          清除
        </button>
        <button
          style={{
            flex: 1,
            padding: "4px 8px",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            background: pathMode ? "#1890ff" : "#fff",
            color: pathMode ? "#fff" : "#000",
            cursor: "pointer",
          }}
          onClick={() => setPathMode(!pathMode)}
        >
          {pathMode ? "关闭路径模式" : "开启路径模式"}
        </button>
      </div>
    </div>
  );
}
