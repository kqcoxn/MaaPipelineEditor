import style from "../../styles/edges.module.less";

import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import classNames from "classnames";

import { SourceHandleTypeEnum } from "./nodes";
import { type EdgeType } from "../../stores/flowStore";

function MarkedEdge(props: EdgeProps & EdgeType) {
  const [edgePath, labelX, labelY] = getBezierPath({ ...props });
  let markClass = "";
  if (props.selected) {
    markClass = style["edge-selected"];
  } else {
    switch (props.sourceHandleId) {
      case SourceHandleTypeEnum.Next:
        markClass = style["edge-next"];
        break;
      case SourceHandleTypeEnum.Interrupt:
        markClass = style["edge-interrupt"];
        break;
      case SourceHandleTypeEnum.Error:
        markClass = style["edge-error"];
        break;
    }
  }

  const Edge = (
    <BaseEdge
      className={classNames(style.edge, markClass)}
      id={props.id}
      path={edgePath}
    />
  );

  return props.label ? (
    <>
      {Edge}
      <EdgeLabelRenderer>
        <div
          className={style.label}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {props.label}
        </div>
      </EdgeLabelRenderer>
    </>
  ) : (
    Edge
  );
}

export const edgeTypes = {
  marked: memo(MarkedEdge),
};
