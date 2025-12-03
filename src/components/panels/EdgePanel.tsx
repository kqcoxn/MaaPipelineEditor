import style from "../../styles/EdgePanel.module.less";

import { memo, useMemo, useCallback } from "react";
import { Switch, Popover, Tag, InputNumber } from "antd";
import classNames from "classnames";

import {
  useFlowStore,
  findNodeLabelById,
  type EdgeType,
} from "../../stores/flow";
import { SourceHandleTypeEnum } from "../flow/nodes";

// 提示词
function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

// 边信息展示
const EdgeInfoElem = memo(
  ({
    edge,
    sourceLabel,
    targetLabel,
    maxOrder,
    onOrderChange,
  }: {
    edge: EdgeType;
    sourceLabel: string;
    targetLabel: string;
    maxOrder: number;
    onOrderChange: (value: number) => void;
  }) => {
    const isNext = edge.sourceHandle === SourceHandleTypeEnum.Next;
    const handleType = isNext ? "next" : "on_error";
    const tagColor = isNext ? "green" : "magenta";

    return (
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
            <span style={{ marginLeft: 8, color: "#999", fontSize: 14 }}>
              / {maxOrder}
            </span>
          </span>
        </div>
      </div>
    );
  }
);

// 边编辑器内容
const EdgeEditorElem = memo(({ edge }: { edge: EdgeType }) => {
  const setEdgeData = useFlowStore((state) => state.setEdgeData);

  const jumpBackValue = useMemo(
    () => edge.attributes?.jump_back ?? false,
    [edge.attributes?.jump_back]
  );

  const handleJumpBackChange = useCallback(
    (checked: boolean) => {
      setEdgeData(edge.id, "jump_back", checked);
    },
    [edge.id, setEdgeData]
  );

  return (
    <div className={style.list}>
      <div className={style.item}>
        <Popover
          placement="left"
          title="jump_back"
          content={LeftTipContentElem(
            "启用跳回机制。当该节点识别命中，系统会在其后续节点链全部执行完毕后，重新返回到该节点所在的父节点，继续尝试识别该父节点的 next 列表。"
          )}
        >
          <div className={style.key}>jump_back</div>
        </Popover>
        <div className={style.value}>
          <Switch
            checkedChildren="开启"
            unCheckedChildren="关闭"
            checked={jumpBackValue}
            onChange={handleJumpBackChange}
          />
        </div>
      </div>
    </div>
  );
});

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

  // 计算同源同类型边的总数
  const maxOrder = useMemo(() => {
    if (!currentEdge) return 1;
    return edges.filter(
      (e) =>
        e.source === currentEdge.source &&
        e.sourceHandle === currentEdge.sourceHandle
    ).length;
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
        <div className="title">连接设置</div>
      </div>
      {currentEdge && (
        <>
          <EdgeInfoElem
            edge={currentEdge}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
            maxOrder={maxOrder}
            onOrderChange={handleOrderChange}
          />
          <EdgeEditorElem edge={currentEdge} />
        </>
      )}
    </div>
  );
}

export default memo(EdgePanel);
