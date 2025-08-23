import style from "../styles/JsonViewer.module.less";

import { memo, useCallback, useMemo, useState } from "react";
import ReactJsonView, {
  type ReactJsonViewProps,
} from "@microlink/react-json-view";
import { Button, Flex } from "antd";

import { useFlowStore, type NodeType } from "../stores/flowStore";
import {
  flowToPipeline,
  uniqueMark,
  configMarkPrefix,
  externalMarkPrefix,
  pipelineToFlow,
} from "../core/parser";
import { ClipboardHelper } from "../utils/clipboard";
import { useConfigStore } from "../stores/configStore";

// viewer
const ViewerElem = memo(({ obj }: { obj: any }) => {
  // 过滤器
  const shouldCollapse = useCallback((field: ReactJsonViewProps) => {
    return (
      field.name === uniqueMark ||
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
  // store
  const isRealTimePreview = useConfigStore(
    (state) => state.configs.isRealTimePreview
  );
  const isShowV1 = useConfigStore((state) => state.configs.isShowV1);
  const selectedNodes = useFlowStore(
    (state) => state.bfSelectedNodes
  ) as NodeType[];
  useFlowStore((state) => state.targetNode);
  const selectedEdges = useFlowStore((state) => state.bfSelectedEdges);

  // 生成 Pipeline
  const isPartable = selectedNodes.length > 0;
  const [rtpTrigger, setRtpTrigger] = useState(0);
  const rtpPipelineObj = useMemo(() => {
    return flowToPipeline(
      isPartable ? { nodes: selectedNodes, edges: selectedEdges } : {}
    );
  }, [
    isRealTimePreview ? selectedNodes : null,
    isRealTimePreview ? selectedEdges : null,
    rtpTrigger,
  ]);
  const manuPelineObj = useMemo(() => {
    return flowToPipeline(
      isPartable ? { nodes: selectedNodes, edges: selectedEdges } : {}
    );
  }, [rtpTrigger]);

  // 渲染
  return (
    <div className={style["json-viewer"]}>
      <div className={style.header}>
        <div className={style.title}>Pipeline JSON</div>
        <div className={style.operations}>
          <Flex className={style.group} gap="small" wrap>
            {isShowV1 && (
              <Button
                variant="filled"
                size="small"
                color="primary"
                onClick={() => pipelineToFlow({ pVersion: 1 })}
              >
                导入v1
              </Button>
            )}
            <Button
              variant="filled"
              size="small"
              color="primary"
              onClick={() => pipelineToFlow({ pVersion: 2 })}
            >
              导入v2
            </Button>
          </Flex>
          <Flex className={style.group} gap="small" wrap>
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
              style={{ display: isPartable ? "block" : "none" }}
              variant="filled"
              size="small"
              color="pink"
              onClick={() => {
                ClipboardHelper.write(
                  flowToPipeline({
                    nodes: selectedNodes,
                    edges: selectedEdges,
                  }),
                  { successMsg: "已将选中节点 Pipeline 复制到粘贴板" }
                );
                setRtpTrigger(rtpTrigger + 1);
              }}
            >
              部分导出
            </Button>
            <Button
              variant="filled"
              size="small"
              color="pink"
              onClick={() => {
                ClipboardHelper.write(flowToPipeline(), {
                  successMsg: "已将全部节点 Pipeline 复制到粘贴板",
                });
                setRtpTrigger(rtpTrigger + 1);
              }}
            >
              全部导出
            </Button>
          </Flex>
        </div>
      </div>
      {/* <div className={style.divider}></div> */}
      <div className={style["viewer-container"]}>
        <ViewerElem
          obj={(isRealTimePreview ? rtpPipelineObj : manuPelineObj) as any}
        />
      </div>
    </div>
  );
}

export default memo(JsonViewer);
