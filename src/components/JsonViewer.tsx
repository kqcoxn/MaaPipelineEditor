import style from "../styles/JsonViewer.module.less";

import { memo, useMemo, useState } from "react";
import ReactJsonView, {
  type ReactJsonViewProps,
} from "@microlink/react-json-view";
import { Button, Flex } from "antd";

import { useFlowStore, type NodeType } from "../stores/flowStore";
import {
  flowToPipeline,
  uniqueMark,
  configMarkPrefix,
  pipelineToFlow,
} from "../core/parser";
import { ClipboardHelper } from "../utils/clipboard";
import { useConfigStore } from "../stores/configStore";

function JsonViewer() {
  // store
  const isRealTimePreview = useConfigStore(
    (state) => state.configs.isRealTimePreview
  );
  const selectedNodes = useFlowStore(
    (state) => state.bfSelectedNodes
  ) as NodeType[];
  useFlowStore((state) => state.targetNode);
  useFlowStore((state) => state.bfSelectedEdges);

  // 生成 Pipeline
  const isPartable = selectedNodes.length > 0;
  const [rtpTrigger, setRtpTrigger] = useState(0);
  const rtpPipelineObj = useMemo(() => {
    return flowToPipeline(isPartable ? { nodes: selectedNodes } : {});
  }, [isRealTimePreview ? selectedNodes : null, rtpTrigger]);
  const manuPelineObj = useMemo(() => {
    return flowToPipeline(isPartable ? { nodes: selectedNodes } : {});
  }, [rtpTrigger]);

  // 折叠项
  const shouldCollapse = (field: ReactJsonViewProps) => {
    return (
      field.name === uniqueMark ||
      (field.name as string).startsWith(configMarkPrefix)
    );
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
            style={{ display: isRealTimePreview ? "none" : "block" }}
            variant="filled"
            size="small"
            color="primary"
            onClick={() => {
              setRtpTrigger(rtpTrigger + 1);
            }}
          >
            编译预览
          </Button>
          <Button
            variant="filled"
            size="small"
            color="pink"
            onClick={() => {
              ClipboardHelper.write(flowToPipeline());
              setRtpTrigger(rtpTrigger + 1);
            }}
          >
            全部导出
          </Button>
        </Flex>
      </div>
      <div className={style["viewer-container"]}>
        <ReactJsonView
          src={(isRealTimePreview ? rtpPipelineObj : manuPelineObj) as any}
          enableClipboard={false}
          iconStyle="square"
          shouldCollapse={shouldCollapse}
        />
      </div>
    </div>
  );
}

export default memo(JsonViewer);
