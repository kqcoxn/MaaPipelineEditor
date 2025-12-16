import style from "../../styles/edges.module.less";

import { memo, useMemo } from "react";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "../../stores/configStore";
import { useFlowStore } from "../../stores/flow";
import { SourceHandleTypeEnum } from "./nodes";

function MarkedEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ ...props });
  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);

  const edge = useFlowStore((state) =>
    state.edges.find((e) => e.id === props.id)
  );

  // 获取选中状态
  const { selectedNodes, selectedEdges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
    }))
  );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    if (focusOpacity === 1) return true;
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;
    if (props.selected) return true;

    // 检查边是否连接到选中的节点
    for (const selectedNode of selectedNodes) {
      if (
        props.source === selectedNode.id ||
        props.target === selectedNode.id
      ) {
        return true;
      }
    }

    return false;
  }, [
    focusOpacity,
    selectedNodes,
    selectedEdges,
    props.source,
    props.target,
    props.selected,
  ]);

  const edgeClass = useMemo(() => {
    let markClass = "";
    if (props.selected) {
      markClass = style["edge-selected"];
    } else {
      const hasJumpBack = edge?.attributes?.jump_back;

      switch (props.sourceHandleId) {
        case SourceHandleTypeEnum.Next:
          markClass = style["edge-next"];
          break;
        case SourceHandleTypeEnum.JumpBack:
          markClass = style["edge-jumpback"];
          break;
        case SourceHandleTypeEnum.Error:
          markClass = hasJumpBack
            ? style["edge-error-jumpback"]
            : style["edge-error"];
          break;
      }
    }
    return classNames(style.edge, markClass);
  }, [props.selected, props.sourceHandleId, edge?.attributes?.jump_back]);

  const labelClass = useMemo(
    () =>
      classNames({
        [style.label]: true,
        [style["label-selected"]]: props.selected,
      }),
    [props.selected]
  );
  const labelStyle = useMemo(() => {
    return {
      transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
    };
  }, [labelX, labelY]);

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  return (
    <g style={opacityStyle}>
      <BaseEdge className={edgeClass} id={props.id} path={edgePath} />
      {showEdgeLabel && props.label != null ? (
        <EdgeLabelRenderer>
          <div className={labelClass} style={labelStyle}>
            {props.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

export const edgeTypes = {
  marked: memo(MarkedEdge),
};
