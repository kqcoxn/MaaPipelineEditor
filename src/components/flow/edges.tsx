import style from "../../styles/edges.module.less";

import { memo, useMemo } from "react";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import classNames from "classnames";

import { SourceHandleTypeEnum } from "./nodes";

function MarkedEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ ...props });

  const edgeClass = useMemo(() => {
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
    return classNames(style.edge, markClass);
  }, [props.selected]);

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

  return (
    <>
      <BaseEdge className={edgeClass} id={props.id} path={edgePath} />
      {props.label != null ? (
        <EdgeLabelRenderer>
          <div className={labelClass} style={labelStyle}>
            {props.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const edgeTypes = {
  marked: memo(MarkedEdge),
};
