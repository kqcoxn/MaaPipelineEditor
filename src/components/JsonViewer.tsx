import style from "../styles/JsonViewer.module.less";

import { memo } from "react";
import ReactJsonView, {
  type ReactJsonViewProps,
} from "@microlink/react-json-view";
import { Button, Flex } from "antd";

import { useFlowStore, type NodeType } from "../stores/flowStore";
import { flowToPipeline, uniqueMark, pipelineToFlow } from "../core/parser";
import { ClipboardHelper } from "../utils/clipboard";

function JsonViewer() {
  // store
  const selectedNodes = useFlowStore(
    (state) => state.bfSelectedNodes
  ) as NodeType[];
  useFlowStore((state) => state.targetNode);
  useFlowStore((state) => state.bfSelectedEdges);

  // 生成 Pipeline
  let pipelineObj = {};
  const autoUpdate = false;
  if (autoUpdate) {
    if (selectedNodes.length > 0) {
      pipelineObj = flowToPipeline({ nodes: selectedNodes });
    } else {
      pipelineObj = flowToPipeline();
    }
  }
  function copyToClipboard() {
    ClipboardHelper.write(autoUpdate ? pipelineObj : flowToPipeline());
  }

  // 折叠项
  const shouldCollapse = (field: ReactJsonViewProps) => {
    return field.name === uniqueMark;
  };

  // 渲染
  return (
    <div className={style["json-viewer"]}>
      <div className={style.header}>
        <div className={style.title}>Pipeline JSON</div>
        <Flex className={style.operations} gap="small" wrap>
          <Button
            variant="filled"
            size="small"
            color="primary"
            onClick={() => pipelineToFlow({ pVersion: 1 })}
          >
            导入v1
          </Button>
          <Button
            variant="filled"
            size="small"
            color="primary"
            onClick={() => pipelineToFlow({ pVersion: 2 })}
          >
            导入v2
          </Button>
          <Button
            variant="filled"
            size="small"
            color="pink"
            onClick={() => copyToClipboard()}
          >
            导出(v2)
          </Button>
        </Flex>
      </div>
      <div className={style["viewer-container"]}>
        <ReactJsonView
          src={pipelineObj}
          enableClipboard={false}
          iconStyle="square"
          shouldCollapse={shouldCollapse}
        />
      </div>
    </div>
  );
}

export default memo(JsonViewer);
