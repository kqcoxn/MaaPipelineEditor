/**
 * 节点列表项组件
 */

import { memo, useCallback } from "react";
import classNames from "classnames";
import type { NodeListItemInfo } from "./types";
import { NodePreviewPopover } from "./NodePreviewPopover";
import style from "./NodeListPanel.module.less";

export interface NodeListItemProps {
  /** 节点信息 */
  node: NodeListItemInfo;
  /** 是否高亮（悬停状态） */
  isHighlighted?: boolean;
  /** 点击回调 */
  onClick?: (node: NodeListItemInfo) => void;
  /** 悬停回调 */
  onHover?: (node: NodeListItemInfo | null) => void;
}

function NodeListItem({
  node,
  isHighlighted,
  onClick,
  onHover,
}: NodeListItemProps) {
  // 点击节点项
  const handleClick = useCallback(() => {
    onClick?.(node);
  }, [node, onClick]);

  // 鼠标进入
  const handleMouseEnter = useCallback(() => {
    onHover?.(node);
  }, [node, onHover]);

  // 鼠标离开
  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  // 构建节点描述
  const getNodeDescription = () => {
    if (node.recognitionType && node.actionType) {
      return `${node.recognitionType} → ${node.actionType}`;
    }
    if (node.nodeType === "external") {
      return "外部引用";
    }
    if (node.nodeType === "anchor") {
      return "重定向";
    }
    if (node.nodeType === "sticker") {
      return "注释";
    }
    if (node.nodeType === "group") {
      return "分组";
    }
    return "";
  };

  return (
    <NodePreviewPopover node={node}>
      <div
        className={classNames(style["node-item"], {
          [style.highlighted]: isHighlighted,
        })}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={style["node-item-main"]}>
          <div className={style["node-item-label"]}>{node.label}</div>
          <div className={style["node-item-info"]}>
            <div className={style["node-item-type"]}>
              {node.recognitionType && (
                <span className={style["recognition-type"]}>
                  {node.recognitionType}
                </span>
              )}
              {node.recognitionType && node.actionType && (
                <span className={style["edge-arrow"]}>→</span>
              )}
              {node.actionType && (
                <span className={style["action-type"]}>{node.actionType}</span>
              )}
              {!node.recognitionType && !node.actionType && (
                <span style={{ color: "#999" }}>{getNodeDescription()}</span>
              )}
            </div>
          </div>
        </div>
        <div className={style["node-item-edges"]}>
          <span className={classNames(style["edge-count"], style.in)}>
            ←{node.inEdgeCount}
          </span>
          <span className={style["edge-arrow"]}>/</span>
          <span className={classNames(style["edge-count"], style.out)}>
            →{node.outEdgeCount}
          </span>
        </div>
      </div>
    </NodePreviewPopover>
  );
}

export default memo(NodeListItem);
