import style from "../../styles/FieldPanel.module.less";

import { useMemo, memo, useCallback } from "react";
import { Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import {
  useFlowStore,
  type PipelineNodeType,
  type ExternalNodeType,
  type AnchorNodeType,
} from "../../stores/flow";
import { NodeTypeEnum } from "../flow/nodes";
import {
  PipelineEditorWithSuspense,
  ExternalEditor,
  AnchorEditor,
} from "./node-editors";
import { FieldPanelToolbar } from "./field-tools";

// 面板
function FieldPanel() {
  const currentNode = useFlowStore((state) => state.targetNode);

  // 内容
  const renderContent = useMemo(() => {
    if (!currentNode) return null;
    switch (currentNode.type) {
      case NodeTypeEnum.Pipeline:
        return (
          <PipelineEditorWithSuspense
            currentNode={currentNode as PipelineNodeType}
          />
        );
      case NodeTypeEnum.External:
        return <ExternalEditor currentNode={currentNode as ExternalNodeType} />;
      case NodeTypeEnum.Anchor:
        return <AnchorEditor currentNode={currentNode as AnchorNodeType} />;
      default:
        return null;
    }
  }, [currentNode]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": currentNode !== null,
      }),
    [currentNode]
  );

  // 删除节点
  const handleDelete = useCallback(() => {
    if (currentNode) {
      const updateNodes = useFlowStore.getState().updateNodes;
      updateNodes([{ type: "remove", id: currentNode.id }]);
    }
  }, [currentNode]);

  // 渲染
  return (
    <div className={panelClass}>
      <div className="header">
        <div className="header-left">
          <FieldPanelToolbar
            nodeName={currentNode?.data.label ?? ""}
            currentNode={currentNode}
          />
        </div>
        <div className="header-center">
          <div className="title">节点字段</div>
        </div>
        <div className="header-right">
          {currentNode && (
            <Tooltip placement="top" title="删除节点">
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
      {renderContent}
    </div>
  );
}

export default memo(FieldPanel);
