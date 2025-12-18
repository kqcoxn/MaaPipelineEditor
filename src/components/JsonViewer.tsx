import style from "../styles/JsonViewer.module.less";

import { memo, useCallback, useMemo, useState, useRef } from "react";
import ReactJsonView, {
  type ReactJsonViewProps,
} from "@microlink/react-json-view";
import { Button, Flex, message } from "antd";
import { useShallow } from "zustand/shallow";

import { useFlowStore, type NodeType } from "../stores/flow";
import { useFileStore } from "../stores/fileStore";
import {
  flowToPipeline,
  configMark,
  configMarkPrefix,
  externalMarkPrefix,
  pipelineToFlow,
} from "../core/parser";
import { ClipboardHelper } from "../utils/clipboard";
import { useConfigStore } from "../stores/configStore";
import { useWSStore } from "../stores/wsStore";
import { CreateFileModal } from "./modals/CreateFileModal";
import { ExportFileModal } from "./modals/ExportFileModal";

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
  const { selectedNodes, selectedEdges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.debouncedSelectedNodes as NodeType[],
      selectedEdges: state.debouncedSelectedEdges,
    }))
  );
  const isRealTimePreview = useConfigStore(
    (state) => state.configs.isRealTimePreview
  );
  const wsConnected = useWSStore((state) => state.connected);
  const currentFilePath = useFileStore(
    (state) => state.currentFile.config.filePath
  );
  const saveFileToLocal = useFileStore((state) => state.saveFileToLocal);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // 文件输入引用
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件导入
  const handleFileImport = async (file: File) => {
    try {
      const text = await file.text();
      const success = await pipelineToFlow({ pString: text });
      if (success) {
        message.success("文件导入成功");
      }
    } catch (err) {
      message.error("文件导入失败，请检查文件格式");
      console.error(err);
    }
  };

  // 文件选择事件
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file);
      // 清空input值，允许选择同一文件
      e.target.value = "";
    }
  };

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
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.jsonc"
        style={{ display: "none" }}
        onChange={onFileSelect}
      />
      <div className={style.header}>
        <div className={style.title}>Pipeline JSON</div>
        <div className={style.operations}>
          <Flex className={style.group} gap="small" wrap>
            <Button
              variant="filled"
              size="small"
              color="primary"
              onClick={async () => {
                const success = await pipelineToFlow();
                if (success) {
                  message.success("导入成功");
                }
              }}
            >
              从粘贴板导入
            </Button>
            <Button
              variant="filled"
              size="small"
              color="primary"
              onClick={() => fileInputRef.current?.click()}
            >
              从文件导入
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
              部分至粘贴板
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
              导出至粘贴板
            </Button>
          </Flex>
          <Flex className={style.group} gap="small" wrap>
            <Button
              variant="filled"
              size="small"
              color="purple"
              onClick={async () => {
                const success = await saveFileToLocal();
                if (success) {
                  setRtpTrigger(rtpTrigger + 1);
                } else {
                  message.error("文件保存失败");
                }
              }}
              style={{
                display:
                  wsConnected && currentFilePath ? "inline-flex" : "none",
              }}
            >
              保存到本地
            </Button>
            {wsConnected ? (
              <Button
                variant="filled"
                size="small"
                color="purple"
                onClick={() => setCreateModalVisible(true)}
              >
                导出为文件
              </Button>
            ) : (
              <Button
                variant="filled"
                size="small"
                color="purple"
                onClick={() => setExportModalVisible(true)}
              >
                导出为文件
              </Button>
            )}
          </Flex>
        </div>
      </div>
      {/* <div className={style.divider}></div> */}
      <div className={style["viewer-container"]}>
        <ViewerElem
          obj={(isRealTimePreview ? rtpPipelineObj : manuPelineObj) as any}
        />
      </div>
      <CreateFileModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
      />
      <ExportFileModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
      />
    </div>
  );
}

export default memo(JsonViewer);
