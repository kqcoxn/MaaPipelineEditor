import style from "../../styles/FieldPanel.module.less";

import { useMemo, memo, useCallback, useState } from "react";
import { Tooltip, Spin } from "antd";
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
  const [isLoading, setIsLoading] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [progressDetail, setProgressDetail] = useState("");

  // 内容
  const renderContent = useMemo(() => {
    if (!currentNode) return null;

    const content = (() => {
      switch (currentNode.type) {
        case NodeTypeEnum.Pipeline:
          return (
            <PipelineEditorWithSuspense
              currentNode={currentNode as PipelineNodeType}
            />
          );
        case NodeTypeEnum.External:
          return (
            <ExternalEditor currentNode={currentNode as ExternalNodeType} />
          );
        case NodeTypeEnum.Anchor:
          return <AnchorEditor currentNode={currentNode as AnchorNodeType} />;
        default:
          return null;
      }
    })();

    // 添加遮罩层
    if (isLoading) {
      return (
        <div style={{ position: "relative" }}>
          {content}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(255, 255, 255, 0.9)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <Spin size="large" />
            <div
              style={{
                marginTop: 16,
                fontSize: 16,
                fontWeight: 500,
                color: "#1890ff",
              }}
            >
              {progressStage}
            </div>
            {progressDetail && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "#666",
                }}
              >
                {progressDetail}
              </div>
            )}
          </div>
        </div>
      );
    }

    return content;
  }, [currentNode, isLoading, progressStage, progressDetail]);

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

  // 进度变化回调
  const handleProgressChange = useCallback((stage: string, detail?: string) => {
    setProgressStage(stage);
    setProgressDetail(detail || "");
  }, []);

  // 渲染
  return (
    <div className={panelClass}>
      <div className="header">
        <div className="header-left">
          <FieldPanelToolbar
            nodeName={currentNode?.data.label ?? ""}
            currentNode={currentNode}
            onLoadingChange={setIsLoading}
            onProgressChange={handleProgressChange}
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
