import style from "../../../../styles/FieldPanel.module.less";
import { memo, useState } from "react";
import { Tooltip, message } from "antd";
import IconFont from "../../../iconfonts";
import type { NodeType } from "../../../../stores/flow/types";
import { useFileStore } from "../../../../stores/fileStore";
import { NodeTypeEnum } from "../../../flow/nodes";
import {
  collectNodeContext,
  predictNodeConfig,
  applyPrediction,
} from "../../../../utils/aiPredictor";
import { useFlowStore } from "../../../../stores/flow";
import { useMFWStore } from "../../../../stores/mfwStore";
import {
  copyNodeName,
  saveNodeAsTemplate,
  copyNodeRecoJSON,
} from "../../../flow/nodes/utils/nodeOperations";

// 左侧工具栏
export const FieldPanelToolbarLeft = memo(
  ({ currentNode }: { currentNode: NodeType | null }) => {
    const showCopyRecoButton =
      currentNode && currentNode.type === NodeTypeEnum.Pipeline;

    const handleCopyNodeName = () => {
      const pureNodeName = currentNode?.data.label || "";
      copyNodeName(pureNodeName);
    };

    const handleCopyRecoJSON = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }
      copyNodeRecoJSON(currentNode.id);
    };

    return (
      <div style={{ display: "flex", gap: 8 }}>
        <Tooltip placement="top" title={"复制节点名"}>
          <IconFont
            className="icon-interactive"
            name="icon-xiaohongshubiaoti"
            size={24}
            onClick={handleCopyNodeName}
          />
        </Tooltip>
        {showCopyRecoButton && (
          <Tooltip placement="top" title="复制 Reco JSON">
            <IconFont
              className="icon-interactive"
              name="icon-kapianshibie"
              size={23}
              onClick={handleCopyRecoJSON}
            />
          </Tooltip>
        )}
      </div>
    );
  }
);

// 右侧工具栏
export const FieldPanelToolbarRight = memo(
  ({
    currentNode,
    onLoadingChange,
    onProgressChange,
    onDelete,
  }: {
    currentNode: NodeType | null;
    onLoadingChange?: (loading: boolean) => void;
    onProgressChange?: (stage: string, detail?: string) => void;
    onDelete?: () => void;
  }) => {
    const [aiPredicting, setAiPredicting] = useState(false);

    const showButtons =
      currentNode && currentNode.type === NodeTypeEnum.Pipeline;

    const handleSaveTemplate = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }
      saveNodeAsTemplate(currentNode.data.label, currentNode.data as any);
    };

    // 处理AI预测
    const handleAIPredict = async () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }

      // 检查前置条件
      const { connectionStatus, controllerId } = useMFWStore.getState();
      if (connectionStatus !== "connected" || !controllerId) {
        message.error("请先连接到本地服务与设备，并确保配置好OCR功能");
        return;
      }

      try {
        setAiPredicting(true);
        onLoadingChange?.(true);

        const nodes = useFlowStore.getState().nodes;
        const edges = useFlowStore.getState().edges;

        // 收集节点上下文
        const context = await collectNodeContext(
          currentNode.id,
          nodes,
          edges,
          true,
          onProgressChange
        );

        // 调用AI预测
        const prediction = await predictNodeConfig(context, onProgressChange);

        // 应用预测结果
        onProgressChange?.("应用配置", "正在填充节点字段...");
        const filledCount = applyPrediction(currentNode.id, prediction);

        if (filledCount > 0) {
          message.success(
            `已成功填充 ${filledCount} 个字段，可在AI对话历史中查看详细推理依据`
          );
        } else {
          message.info(
            "AI分析完成，但没有需要填充的字段，可在AI对话历史中查看推理依据"
          );
        }
      } catch (err: any) {
        const errorMsg = err.message || "AI预测失败";

        // 根据错误类型给出不同提示
        if (errorMsg.includes("未连接")) {
          message.error("请先连接到本地服务与设备");
        } else if (errorMsg.includes("API") || errorMsg.includes("配置")) {
          message.error("请先在配置面板中设置AI API");
        } else if (errorMsg.includes("OCR")) {
          message.error("OCR识别失败，请确保OCR功能已正确配置");
        } else {
          message.error(`AI预测失败: ${errorMsg}`);
        }

        console.error("AI预测失败:", err);
      } finally {
        setAiPredicting(false);
        onLoadingChange?.(false);
      }
    };

    if (!showButtons) {
      return null;
    }

    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Tooltip placement="top" title="保存为模板">
          <IconFont
            className="icon-interactive"
            name="icon-biaodanmoban"
            size={24}
            onClick={handleSaveTemplate}
          />
        </Tooltip>
        <Tooltip placement="top" title="AI智能预测节点配置">
          <IconFont
            className={aiPredicting ? "icon-loading" : "icon-interactive"}
            name="icon-jiqiren"
            size={24}
            onClick={aiPredicting ? undefined : handleAIPredict}
            style={{
              opacity: aiPredicting ? 0.6 : 1,
              cursor: aiPredicting ? "not-allowed" : "pointer",
            }}
          />
        </Tooltip>
        <Tooltip placement="top" title="删除节点">
          <IconFont
            className="icon-interactive"
            name="icon-shanchu"
            size={19}
            color="#ff4a4a"
            onClick={onDelete}
          />
        </Tooltip>
      </div>
    );
  }
);
