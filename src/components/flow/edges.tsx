import style from "../../styles/edges.module.less";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import classNames from "classnames";

import { SourceHandleTypeEnum } from "./nodes";

function MarkedEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({ ...props });
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

  return (
    <BaseEdge
      className={classNames(style.edge, markClass)}
      id={props.id}
      path={edgePath}
    />
  );
}

export const edgeTypes = {
  marked: memo(MarkedEdge),
};
