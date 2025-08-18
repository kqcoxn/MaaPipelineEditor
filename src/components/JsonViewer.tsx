import style from "../styles/JsonViewer.module.less";

import { memo } from "react";
import ReactJsonView from "@microlink/react-json-view";
import { Button, Flex } from "antd";

import { useFlowStore, type NodeType } from "../stores/flowStore";
import { flowToPipeline } from "../core/parser";

function JsonViewer() {
  // store
  const selectedNodes = useFlowStore(
    (state) => state.bfSelectedNodes
  ) as NodeType[];
  useFlowStore((state) => state.targetNode);
  useFlowStore((state) => state.edges);

  // 生成预览
  let src = {};
  if (selectedNodes.length > 0) {
    src = flowToPipeline({ nodes: selectedNodes });
  } else {
    src = flowToPipeline();
  }

  // 渲染
  return (
    <div className={style["json-viewer"]}>
      <div className={style.header}>
        <div className={style.title}>Pipeline JSON</div>
        <Flex className={style.operations} gap="small" wrap>
          <Button variant="filled" size="small" color="primary">
            导入v1
          </Button>
          <Button variant="filled" size="small" color="primary">
            导入v2
          </Button>
          <Button variant="filled" size="small" color="pink">
            导出
          </Button>
        </Flex>
      </div>
      <div className={style["viewer-container"]}>
        <ReactJsonView src={src} enableClipboard={false} iconStyle="square" />
      </div>
    </div>
  );
}

export default memo(JsonViewer);
