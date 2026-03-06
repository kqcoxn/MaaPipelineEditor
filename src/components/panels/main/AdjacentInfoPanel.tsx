import { useMemo, memo, useCallback } from "react";
import { Collapse, Tag, Empty } from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useFlowStore } from "../../../stores/flow";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
  NodeTypeEnum,
} from "../../flow/nodes";
import type { EdgeType } from "../../../stores/flow/types";
import style from "./AdjacentInfoPanel.module.less";

/**邻接信息面板 - 展示选中节点的前驱和后继节点信息 */

interface AdjacentInfoPanelProps {
  currentNodeId: string;
  currentNodeLabel: string;
}

// 前驱节点信息
interface PredecessorInfo {
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeTypeEnum;
  edgeType: SourceHandleTypeEnum; // 源节点的输出类型
  order: number;
  isJumpBack: boolean;
}

// 后继节点信息
interface SuccessorInfo {
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeTypeEnum;
  edgeType: SourceHandleTypeEnum; // 当前节点的输出类型
  order: number;
  isJumpBack: boolean;
}

function AdjacentInfoPanel({ currentNodeId, currentNodeLabel }: AdjacentInfoPanelProps) {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const instance = useFlowStore((state) => state.instance);

  // 计算前驱节点
  const predecessors = useMemo(() => {
    const result: PredecessorInfo[] = [];
    
    edges.forEach((edge: EdgeType) => {
      if (edge.target === currentNodeId) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          result.push({
            nodeId: edge.source,
            nodeLabel: sourceNode.data?.label || "未知",
            nodeType: sourceNode.type as NodeTypeEnum,
            edgeType: edge.sourceHandle,
            order: edge.label as number,
            isJumpBack: edge.targetHandle === TargetHandleTypeEnum.JumpBack,
          });
        }
      }
    });

    // 按 edgeType 分组，然后按 order 排序
    result.sort((a, b) => {
      if (a.edgeType !== b.edgeType) {
        return a.edgeType === SourceHandleTypeEnum.Next ? -1 : 1;
      }
      return a.order - b.order;
    });

    return result;
  }, [edges, currentNodeId, nodes]);

  // 计算后继节点
  const successors = useMemo(() => {
    const result: SuccessorInfo[] = [];
    
    edges.forEach((edge: EdgeType) => {
      if (edge.source === currentNodeId) {
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (targetNode) {
          result.push({
            nodeId: edge.target,
            nodeLabel: targetNode.data?.label || "未知",
            nodeType: targetNode.type as NodeTypeEnum,
            edgeType: edge.sourceHandle,
            order: edge.label as number,
            isJumpBack: edge.targetHandle === TargetHandleTypeEnum.JumpBack,
          });
        }
      }
    });

    // 按 edgeType 分组，然后按 order 排序
    result.sort((a, b) => {
      if (a.edgeType !== b.edgeType) {
        return a.edgeType === SourceHandleTypeEnum.Next ? -1 : 1;
      }
      return a.order - b.order;
    });

    return result;
  }, [edges, currentNodeId, nodes]);

  // 按类型分组后继节点
  const successorsByType = useMemo(() => {
    const nextSuccessors = successors.filter(
      (s) => s.edgeType === SourceHandleTypeEnum.Next
    );
    const errorSuccessors = successors.filter(
      (s) => s.edgeType === SourceHandleTypeEnum.Error
    );
    return { nextSuccessors, errorSuccessors };
  }, [successors]);

  // 点击节点跳转
  const handleNodeClick = useCallback((nodeId: string) => {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    // 取消其他节点的选中状态，选中目标节点
    useFlowStore.getState().updateNodes(
      nodes.map((n) => ({
        type: "select" as const,
        id: n.id,
        selected: n.id === nodeId,
      }))
    );

    // 聚焦视图到该节点
    if (instance) {
      const { x, y } = targetNode.position;
      const { width = 200, height = 100 } = targetNode.measured || {};
      instance.setCenter(x + width / 2, y + height / 2, {
        duration: 500,
        zoom: 1.5,
      });
    }
  }, [nodes, instance]);

  // 渲染节点标签
  const renderNodeTag = (
    nodeType: NodeTypeEnum,
    label: string,
    nodeId: string
  ) => {
    const typeColors: Record<NodeTypeEnum, string> = {
      [NodeTypeEnum.Pipeline]: "blue",
      [NodeTypeEnum.External]: "purple",
      [NodeTypeEnum.Anchor]: "cyan",
      [NodeTypeEnum.Sticker]: "gold",
      [NodeTypeEnum.Group]: "green",
    };

    return (
      <Tag
        color={typeColors[nodeType] || "default"}
        className={style["node-tag"]}
        onClick={() => handleNodeClick(nodeId)}
      >
        {label}
      </Tag>
    );
  };

  // 渲染前驱节点列表
  const renderPredecessors = () => {
    // 按类型分组
    const nextPreds = predecessors.filter(
      (p) => p.edgeType === SourceHandleTypeEnum.Next
    );
    const errorPreds = predecessors.filter(
      (p) => p.edgeType === SourceHandleTypeEnum.Error
    );

    return (
      <div className={style["node-list"]}>
        {nextPreds.length > 0 && (
          <div className={style["group-section"]}>
            <div className={style["group-label"]}>
              <Tag color="green">next</Tag>
              <span className={style["count"]}>({nextPreds.length})</span>
            </div>
            <div className={style["node-items"]}>
              {nextPreds.map((pred) => (
                <div key={`${pred.nodeId}-${pred.order}`} className={style["node-item"]}>
                  <span className={style["order"]}>{pred.order}.</span>
                  {renderNodeTag(pred.nodeType, pred.nodeLabel, pred.nodeId)}
                  {pred.isJumpBack && (
                    <Tag color="orange" className={style["mini-tag"]}>
                      jumpback
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {errorPreds.length > 0 && (
          <div className={style["group-section"]}>
            <div className={style["group-label"]}>
              <Tag color="magenta">on_error</Tag>
              <span className={style["count"]}>({errorPreds.length})</span>
            </div>
            <div className={style["node-items"]}>
              {errorPreds.map((pred) => (
                <div key={`${pred.nodeId}-${pred.order}`} className={style["node-item"]}>
                  <span className={style["order"]}>{pred.order}.</span>
                  {renderNodeTag(pred.nodeType, pred.nodeLabel, pred.nodeId)}
                  {pred.isJumpBack && (
                    <Tag color="orange" className={style["mini-tag"]}>
                      jumpback
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染后继节点列表
  const renderSuccessors = () => {
    const { nextSuccessors, errorSuccessors } = successorsByType;

    return (
      <div className={style["node-list"]}>
        {nextSuccessors.length > 0 && (
          <div className={style["group-section"]}>
            <div className={style["group-label"]}>
              <Tag color="green">next</Tag>
              <span className={style["count"]}>({nextSuccessors.length})</span>
            </div>
            <div className={style["node-items"]}>
              {nextSuccessors.map((succ) => (
                <div key={`${succ.nodeId}-${succ.order}`} className={style["node-item"]}>
                  <span className={style["order"]}>{succ.order}.</span>
                  {renderNodeTag(succ.nodeType, succ.nodeLabel, succ.nodeId)}
                  {succ.isJumpBack && (
                    <Tag color="orange" className={style["mini-tag"]}>
                      jumpback
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {errorSuccessors.length > 0 && (
          <div className={style["group-section"]}>
            <div className={style["group-label"]}>
              <Tag color="magenta">on_error</Tag>
              <span className={style["count"]}>({errorSuccessors.length})</span>
            </div>
            <div className={style["node-items"]}>
              {errorSuccessors.map((succ) => (
                <div key={`${succ.nodeId}-${succ.order}`} className={style["node-item"]}>
                  <span className={style["order"]}>{succ.order}.</span>
                  {renderNodeTag(succ.nodeType, succ.nodeLabel, succ.nodeId)}
                  {succ.isJumpBack && (
                    <Tag color="orange" className={style["mini-tag"]}>
                      jumpback
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 构建折叠面板项 - 只显示有数据的部分
  const collapseItems = useMemo(() => {
    const items = [];
    
    if (predecessors.length > 0) {
      items.push({
        key: "predecessors",
        label: (
          <div className={style["collapse-header"]}>
            <span>前驱节点</span>
            <ArrowLeftOutlined className={style["icon"]} />
            <span className={style["count"]}>({predecessors.length})</span>
          </div>
        ),
        children: renderPredecessors(),
      });
    }
    
    if (successors.length > 0) {
      items.push({
        key: "successors",
        label: (
          <div className={style["collapse-header"]}>
            <span>后继节点</span>
            <ArrowRightOutlined className={style["icon"]} />
            <span className={style["count"]}>({successors.length})</span>
          </div>
        ),
        children: renderSuccessors(),
      });
    }
    
    return items;
  }, [predecessors, successors]);

  // 无连接提示
  const hasNoConnections = predecessors.length === 0 && successors.length === 0;

  return (
    <div className={style["adjacent-panel"]}>
      {hasNoConnections ? (
        <div className={style["empty-container"]}>
          <Empty
            description={
              <span>
                节点 <strong>{currentNodeLabel}</strong> 无任何连接
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <Collapse
          defaultActiveKey={["predecessors", "successors"]}
          ghost
          items={collapseItems}
        />
      )}
    </div>
  );
}

export default memo(AdjacentInfoPanel);
