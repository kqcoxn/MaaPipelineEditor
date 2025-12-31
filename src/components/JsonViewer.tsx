import style from "../styles/FloatingJsonPanel.module.less";

import React, { memo, useCallback, useMemo, useEffect } from "react";
import ReactJsonView, {
  type ReactJsonViewProps,
} from "@microlink/react-json-view";
import { Button, Tooltip } from "antd";
import { CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";

import { useFlowStore, type NodeType } from "../stores/flow";
import { useToolbarStore } from "../stores/toolbarStore";
import {
  flowToPipeline,
  configMark,
  configMarkPrefix,
  externalMarkPrefix,
} from "../core/parser";

// viewer
const ViewerElem = memo(({ obj }: { obj: any }) => {
  // 过滤器
  const shouldCollapse = useCallback((field: ReactJsonViewProps) => {
    return (
      field.name === configMark ||
      (field.name as string).startsWith(configMarkPrefix) ||
      (field.name as string).startsWith(externalMarkPrefix)
    );
  }, []);

  return (
    <ReactJsonView
      src={obj}
      enableClipboard={false}
      iconStyle="square"
      shouldCollapse={shouldCollapse}
    />
  );
});

function JsonViewer() {
  const jsonPanelVisible = useToolbarStore((state) => state.jsonPanelVisible);
  const currentRightPanel = useToolbarStore((state) => state.currentRightPanel);
  const setJsonPanelVisible = useToolbarStore(
    (state) => state.setJsonPanelVisible
  );
  const { selectedNodes, selectedEdges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.debouncedSelectedNodes as NodeType[],
      selectedEdges: state.debouncedSelectedEdges,
    }))
  );
  // 生成 Pipeline
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const pipelineObj = useMemo(() => {
    return flowToPipeline();
  }, [selectedNodes, selectedEdges, refreshTrigger]);

  // 手动刷新
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // 当其他面板打开时自动关闭 JSON 面板
  useEffect(() => {
    if (currentRightPanel !== "json" && currentRightPanel !== null) {
      setJsonPanelVisible(false);
    }
  }, [currentRightPanel, setJsonPanelVisible]);

  // 关闭面板
  const handleClose = () => {
    setJsonPanelVisible(false);
  };

  // 面板类名
  const panelClassName = `${style.floatingJsonPanel} ${
    jsonPanelVisible ? style.visible : style.hidden
  }`;

  // 渲染
  return (
    <div className={panelClassName}>
      <div className={style.header}>
        <div className={style.title}>Pipeline JSON</div>
        <div className={style.actions}>
          <Tooltip title="刷新">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleClose}
            />
          </Tooltip>
        </div>
      </div>
      <div className={style.viewerContainer}>
        <ViewerElem obj={pipelineObj as any} />
      </div>
    </div>
  );
}

export default memo(JsonViewer);
