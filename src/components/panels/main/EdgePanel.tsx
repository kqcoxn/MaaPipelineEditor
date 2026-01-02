import style from "../../../styles/EdgePanel.module.less";

import { memo, useMemo, useCallback, useEffect } from "react";
import { Tag, InputNumber, Tooltip, Switch } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";

import {
  useFlowStore,
  findNodeLabelById,
  type EdgeType,
  type NodeType,
} from "../../../stores/flow";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../flow/nodes";
import { useToolbarStore } from "../../../stores/toolbarStore";
import { useConfigStore } from "../../../stores/configStore";
import { DraggablePanel } from "../common/DraggablePanel";

// 获取连接类型信息
const getEdgeTypeTags = (edge: EdgeType, nodes: NodeType[]) => {
  const tags: { label: string; color: string }[] = [];

  // jumpback
  const isJumpBack = edge.targetHandle === TargetHandleTypeEnum.JumpBack;
  if (isJumpBack) {
    tags.push({ label: "jumpback", color: "orange" });
  }

  // anchor
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (targetNode?.type === NodeTypeEnum.Anchor) {
    tags.push({ label: "anchor", color: "blue" });
  }

  // 基础连接类型
  switch (edge.sourceHandle) {
    case SourceHandleTypeEnum.Next:
      tags.push({ label: "next", color: "green" });
      break;
    case SourceHandleTypeEnum.Error:
      tags.push({ label: "on_error", color: "magenta" });
      break;
  }

  return tags;
};

// 边信息展示
const EdgeInfoElem = memo(
  ({
    edge,
    sourceLabel,
    targetLabel,
    maxOrder,
    tags,
    onOrderChange,
    onJumpBackChange,
  }: {
    edge: EdgeType;
    sourceLabel: string;
    targetLabel: string;
    maxOrder: number;
    tags: { label: string; color: string }[];
    onOrderChange: (value: number) => void;
    onJumpBackChange: (checked: boolean) => void;
  }) => {
    return (
      <>
        <div className={style.info}>
          <div className={style["info-item"]}>
            <span className={style.label}>源节点</span>
            <span className={style.content}>{sourceLabel}</span>
          </div>
          <div className={style["info-item"]}>
            <span className={style.label}>目标节点</span>
            <span className={style.content}>{targetLabel}</span>
          </div>
          <div className={style["info-item"]}>
            <span className={style.label}>连接类型</span>
            <span className={style.content}>
              {tags.map((tag, index) => (
                <Tag key={index} color={tag.color}>
                  {tag.label}
                </Tag>
              ))}
            </span>
          </div>
          <div className={style["info-item"]}>
            <span className={style.label}>顺序</span>
            <span className={style.content}>
              <InputNumber
                size="small"
                min={1}
                max={maxOrder}
                value={edge.label as number}
                onChange={(val) => val && onOrderChange(val)}
                style={{ width: 50 }}
                controls={true}
              />
              <span style={{ marginLeft: 8, color: "#999", fontSize: 16 }}>
                / {maxOrder}
              </span>
            </span>
          </div>
        </div>
        {edge.sourceHandle === SourceHandleTypeEnum.Error && (
          <div className={style["jumpback-section"]}>
            <div className={style["info-item"]}>
              <span className={style.label}>JumpBack</span>
              <span className={style.content}>
                <Switch
                  size="small"
                  checked={edge.attributes?.jump_back ?? false}
                  onChange={onJumpBackChange}
                />
              </span>
            </div>
          </div>
        )}
      </>
    );
  }
);

// 边编辑面板
function EdgePanel() {
  const selectedEdges = useFlowStore((state) => state.selectedEdges);
  const nodes = useFlowStore((state) => state.nodes);
  const targetNode = useFlowStore((state) => state.targetNode);
  const fieldPanelMode = useConfigStore(
    (state) => state.configs.fieldPanelMode
  );
  const setCurrentRightPanel = useToolbarStore(
    (state) => state.setCurrentRightPanel
  );

  // 判断是否只有一条边被选中且没有选中节点
  const currentEdge = useMemo(() => {
    if (selectedEdges.length === 1 && !targetNode) {
      return selectedEdges[0];
    }
    return null;
  }, [selectedEdges, targetNode]);

  // 当面板打开时通知 toolbarStore
  useEffect(() => {
    if (currentEdge) {
      setCurrentRightPanel("edge");
    }
  }, [currentEdge, setCurrentRightPanel]);

  const edges = useFlowStore((state) => state.edges);
  const setEdgeLabel = useFlowStore((state) => state.setEdgeLabel);
  const setEdgeData = useFlowStore((state) => state.setEdgeData);
  const updateEdges = useFlowStore((state) => state.updateEdges);

  // 获取源节点和目标节点的名称
  const { sourceLabel, targetLabel } = useMemo(() => {
    if (!currentEdge) {
      return { sourceLabel: "", targetLabel: "" };
    }
    return {
      sourceLabel: findNodeLabelById(nodes, currentEdge.source) ?? "未知",
      targetLabel: findNodeLabelById(nodes, currentEdge.target) ?? "未知",
    };
  }, [currentEdge, nodes]);

  // 总边数
  const maxOrder = useMemo(() => {
    if (!currentEdge) return 1;
    return edges.filter((e) => {
      if (e.source !== currentEdge.source) return false;
      return e.sourceHandle === currentEdge.sourceHandle;
    }).length;
  }, [currentEdge, edges]);

  // 顺序变更处理
  const handleOrderChange = useCallback(
    (value: number) => {
      if (currentEdge) {
        setEdgeLabel(currentEdge.id, value);
      }
    },
    [currentEdge, setEdgeLabel]
  );

  // jump_back 开关变更处理
  const handleJumpBackChange = useCallback(
    (checked: boolean) => {
      if (currentEdge) {
        setEdgeData(currentEdge.id, "jump_back", checked);
      }
    },
    [currentEdge, setEdgeData]
  );

  // 删除连接
  const handleDelete = useCallback(() => {
    if (currentEdge) {
      updateEdges([{ type: "remove", id: currentEdge.id }]);
    }
  }, [currentEdge, updateEdges]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": currentEdge !== null,
        "panel-draggable": fieldPanelMode === "draggable",
      }),
    [currentEdge, fieldPanelMode]
  );

  // 面板内容
  const panelContent = (
    <>
      <div className="header">
        <div className="header-left"></div>
        <div className="header-center">
          <div className="title">连接设置</div>
        </div>
        <div className="header-right">
          {currentEdge && (
            <Tooltip placement="top" title="删除连接">
              <IconFont
                className="icon-interactive"
                name="icon-shanchu"
                size={20}
                color="#ff4a4a"
                onClick={handleDelete}
              />
            </Tooltip>
          )}
        </div>
      </div>
      {currentEdge && (
        <>
          <EdgeInfoElem
            edge={currentEdge}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
            maxOrder={maxOrder}
            tags={getEdgeTypeTags(currentEdge, nodes)}
            onOrderChange={handleOrderChange}
            onJumpBackChange={handleJumpBackChange}
          />
        </>
      )}
    </>
  );

  // 渲染
  if (fieldPanelMode === "inline") {
    return null;
  }

  if (fieldPanelMode === "draggable") {
    return (
      <DraggablePanel
        panelType="edge"
        isVisible={currentEdge !== null}
        className={panelClass}
        defaultRight={10}
        defaultTop={70}
      >
        {panelContent}
      </DraggablePanel>
    );
  }

  return <div className={panelClass}>{panelContent}</div>;
}

export default memo(EdgePanel);
