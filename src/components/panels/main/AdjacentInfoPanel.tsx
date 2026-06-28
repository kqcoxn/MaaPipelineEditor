import { useMemo, memo, useCallback } from "react";
import { Collapse, Tag, Empty } from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  HolderOutlined,
} from "@ant-design/icons";
import { CSS } from "@dnd-kit/utilities";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useFlowStore, getNodeAbsolutePosition } from "../../../stores/flow";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
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
  edgeId: string; // 边 id，用于拖拽排序
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeTypeEnum;
  edgeType: SourceHandleTypeEnum; // 当前节点的输出类型
  order: number;
  isJumpBack: boolean;
}

// dnd-kit 用的唯一 id：source-sourceHandle-edgeId
function makeSortableId(edge: { id: string }, source: string, handle: SourceHandleTypeEnum) {
  return `${source}-${handle}-${edge.id}`;
}

function AdjacentInfoPanel({ currentNodeId, currentNodeLabel }: AdjacentInfoPanelProps) {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const instance = useFlowStore((state) => state.instance);
  const reorderEdges = useFlowStore((state) => state.reorderEdges);

  // 嵌入模式权限控制（与 Flow.tsx 一致）
  const { isEmbed, isCapAllowed } = useEmbedMode();
  const readOnly = isEmbed && isCapAllowed("readOnly");

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
            edgeId: edge.id,
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
      const { x, y } = getNodeAbsolutePosition(targetNode, nodes);
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

  // 渲染前驱节点列表（只读，无拖拽）
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

  // 渲染后继节点列表（next / on_error 组各自独立排序，不跨组）
  const renderSuccessors = () => {
    const { nextSuccessors, errorSuccessors } = successorsByType;

    return (
      <div className={style["node-list"]}>
        {nextSuccessors.length > 0 && (
          <SuccessorGroup
            groupTag="next"
            tagColor="green"
            items={nextSuccessors}
            sourceHandle={SourceHandleTypeEnum.Next}
            source={currentNodeId}
            readOnly={readOnly}
            onReorder={reorderEdges}
            renderNodeTag={renderNodeTag}
          />
        )}
        {errorSuccessors.length > 0 && (
          <SuccessorGroup
            groupTag="on_error"
            tagColor="magenta"
            items={errorSuccessors}
            sourceHandle={SourceHandleTypeEnum.Error}
            source={currentNodeId}
            readOnly={readOnly}
            onReorder={reorderEdges}
            renderNodeTag={renderNodeTag}
          />
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
            {!readOnly && (
              <span className={style["drag-hint"]}>可拖拽调序</span>
            )}
          </div>
        ),
        children: renderSuccessors(),
      });
    }

    return items;
  }, [predecessors, successors, readOnly]);

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

// ===== 后继分组（可拖拽调序）=====

interface SuccessorGroupProps {
  groupTag: string;
  tagColor: string;
  items: SuccessorInfo[];
  source: string;
  sourceHandle: SourceHandleTypeEnum;
  readOnly: boolean;
  onReorder: (
    source: string,
    sourceHandle: SourceHandleTypeEnum,
    orderedEdgeIds: string[],
  ) => void;
  renderNodeTag: (
    nodeType: NodeTypeEnum,
    label: string,
    nodeId: string
  ) => React.ReactNode;
}

// 单个后继分组：一个独立的 DndContext（不跨组）
const SuccessorGroup: React.FC<SuccessorGroupProps> = memo(
  ({
    groupTag,
    tagColor,
    items,
    source,
    sourceHandle,
    readOnly,
    onReorder,
    renderNodeTag,
  }) => {
    const sensor = useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    });

    // 本组的可排序 id 列表（按当前 order）
    const sortableIds = useMemo(
      () => items.map((s) => makeSortableId({ id: s.edgeId }, source, sourceHandle)),
      [items, source, sourceHandle],
    );

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = sortableIds.indexOf(active.id as string);
        const newIndex = sortableIds.indexOf(over.id as string);
        if (oldIndex < 0 || newIndex < 0) return;

        // 算出新顺序的 edgeId 数组，调用一次 reorderEdges（一条历史）
        const reordered = arrayMove(items, oldIndex, newIndex);
        onReorder(
          source,
          sourceHandle,
          reordered.map((s) => s.edgeId),
        );
      },
      [items, sortableIds, source, sourceHandle, onReorder],
    );

    return (
      <div className={style["group-section"]}>
        <div className={style["group-label"]}>
          <Tag color={tagColor}>{groupTag}</Tag>
          <span className={style["count"]}>({items.length})</span>
        </div>
        <DndContext
          sensors={[sensor]}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className={style["node-items"]}>
              {items.map((succ) => (
                <SortableSuccessorItem
                  key={succ.edgeId}
                  item={succ}
                  source={source}
                  sourceHandle={sourceHandle}
                  readOnly={readOnly}
                  renderNodeTag={renderNodeTag}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  },
);

SuccessorGroup.displayName = "SuccessorGroup";

interface SortableSuccessorItemProps {
  item: SuccessorInfo;
  source: string;
  sourceHandle: SourceHandleTypeEnum;
  readOnly: boolean;
  renderNodeTag: (
    nodeType: NodeTypeEnum,
    label: string,
    nodeId: string
  ) => React.ReactNode;
}

// 单个可拖拽后继项：手柄负责拖、整行保留点击跳转
const SortableSuccessorItem: React.FC<SortableSuccessorItemProps> = memo(
  ({ item, source, sourceHandle, readOnly, renderNodeTag }) => {
    const sortableId = makeSortableId({ id: item.edgeId }, source, sourceHandle);
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: sortableId, disabled: readOnly });

    const itemStyle: React.CSSProperties = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={itemStyle}
        className={`${style["node-item"]} ${isDragging ? style["dragging"] : ""}`}
      >
        {!readOnly && (
          <span
            {...attributes}
            {...listeners}
            className={style["drag-handle"]}
            title="拖拽调整顺序"
          >
            <HolderOutlined />
          </span>
        )}
        <span className={style["order"]}>{item.order}.</span>
        {renderNodeTag(item.nodeType, item.nodeLabel, item.nodeId)}
        {item.isJumpBack && (
          <Tag color="orange" className={style["mini-tag"]}>
            jumpback
          </Tag>
        )}
      </div>
    );
  },
);

SortableSuccessorItem.displayName = "SortableSuccessorItem";

export default memo(AdjacentInfoPanel);
