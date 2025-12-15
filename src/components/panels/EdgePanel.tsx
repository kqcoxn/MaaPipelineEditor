import style from "../../styles/EdgePanel.module.less";

import { memo, useMemo, useCallback } from "react";
import { Tag, InputNumber, Tooltip, Switch } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import {
  useFlowStore,
  findNodeLabelById,
  type EdgeType,
} from "../../stores/flow";
import { SourceHandleTypeEnum } from "../flow/nodes";

// 获取连接类型和颜色
const getEdgeTypeInfo = (edge: EdgeType) => {
  switch (edge.sourceHandle) {
    case SourceHandleTypeEnum.Next:
      return { handleType: "next", tagColor: "green" };
    case SourceHandleTypeEnum.JumpBack:
      return { handleType: "jump_back", tagColor: "orange" };
    case SourceHandleTypeEnum.Error:
      return {
        handleType: "on_error",
        tagColor: edge.attributes?.jump_back ? "purple" : "magenta",
      };
    default:
      return { handleType: "unknown", tagColor: "default" };
  }
};

// 边信息展示
const EdgeInfoElem = memo(
  ({
    edge,
    sourceLabel,
    targetLabel,
    maxOrder,
    handleType,
    tagColor,
    onOrderChange,
    onJumpBackChange,
  }: {
    edge: EdgeType;
    sourceLabel: string;
    targetLabel: string;
    maxOrder: number;
    handleType: string;
    tagColor: string;
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
              <Tag color={tagColor}>{handleType}</Tag>
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

  // 判断是否只有一条边被选中且没有选中节点
  const currentEdge = useMemo(() => {
    if (selectedEdges.length === 1 && !targetNode) {
      return selectedEdges[0];
    }
    return null;
  }, [selectedEdges, targetNode]);

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

    const isNextGroup =
      currentEdge.sourceHandle === SourceHandleTypeEnum.Next ||
      currentEdge.sourceHandle === SourceHandleTypeEnum.JumpBack;

    return edges.filter((e) => {
      if (e.source !== currentEdge.source) return false;

      if (isNextGroup) {
        // next 和 jumpback 共享排序
        return (
          e.sourceHandle === SourceHandleTypeEnum.Next ||
          e.sourceHandle === SourceHandleTypeEnum.JumpBack
        );
      } else {
        // 独立计数
        return e.sourceHandle === currentEdge.sourceHandle;
      }
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
      }),
    [currentEdge]
  );

  // 渲染
  return (
    <div className={panelClass}>
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
            handleType={getEdgeTypeInfo(currentEdge).handleType}
            tagColor={getEdgeTypeInfo(currentEdge).tagColor}
            onOrderChange={handleOrderChange}
            onJumpBackChange={handleJumpBackChange}
          />
        </>
      )}
    </div>
  );
}

export default memo(EdgePanel);
