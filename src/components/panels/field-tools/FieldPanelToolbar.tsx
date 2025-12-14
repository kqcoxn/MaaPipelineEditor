import style from "../../../styles/FieldPanel.module.less";
import { memo, useState } from "react";
import { Tooltip, Modal, Input, message } from "antd";
import IconFont from "../../iconfonts";
import type {
  NodeType,
  PipelineNodeDataType,
} from "../../../stores/flow/types";
import { useFileStore } from "../../../stores/fileStore";
import { ClipboardHelper } from "../../../utils/clipboard";
import { useCustomTemplateStore } from "../../../stores/customTemplateStore";
import { NodeTypeEnum } from "../../flow/nodes";
import {
  collectNodeContext,
  predictNodeConfig,
  applyPrediction,
} from "../../../utils/aiPredictor";
import { useFlowStore } from "../../../stores/flow";
import { useMFWStore } from "../../../stores/mfwStore";

export const FieldPanelToolbar = memo(
  ({
    nodeName,
    currentNode,
    onLoadingChange,
    onProgressChange,
  }: {
    nodeName: string;
    currentNode: NodeType | null;
    onLoadingChange?: (loading: boolean) => void;
    onProgressChange?: (stage: string, detail?: string) => void;
  }) => {
    const prefix = useFileStore((state) => state.currentFile.config.prefix);
    const addTemplate = useCustomTemplateStore((state) => state.addTemplate);
    const hasTemplate = useCustomTemplateStore((state) => state.hasTemplate);
    const updateTemplate = useCustomTemplateStore(
      (state) => state.updateTemplate
    );

    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [templateName, setTemplateName] = useState("");
    const [aiPredicting, setAiPredicting] = useState(false);

    if (prefix) nodeName = prefix + "_" + nodeName;

    const showSaveButton =
      currentNode && currentNode.type === NodeTypeEnum.Pipeline;

    const handleSaveTemplate = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }
      setTemplateName(currentNode.data.label || "");
      setSaveModalVisible(true);
    };

    const handleSaveConfirm = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }

      const trimmedName = templateName.trim();

      // 名称验证
      if (!trimmedName) {
        message.error("模板名称不能为空");
        return;
      }

      if (trimmedName.length > 30) {
        message.error("模板名称长度不能超过30个字符");
        return;
      }

      // 检查名称重复
      if (hasTemplate(trimmedName)) {
        Modal.confirm({
          title: "模板名称已存在",
          content: `模板 "${trimmedName}" 已存在，是否覆盖？`,
          okText: "覆盖",
          cancelText: "重新输入",
          onOk: () => {
            updateTemplate(
              trimmedName,
              currentNode.data as PipelineNodeDataType
            );
            setSaveModalVisible(false);
          },
        });
      } else {
        const success = addTemplate(
          trimmedName,
          currentNode.data as PipelineNodeDataType
        );
        if (success) {
          setSaveModalVisible(false);
        }
      }
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

    return (
      <>
        <div className={style.tools}>
          <Tooltip placement="top" title={"复制节点名"}>
            <IconFont
              className="icon-interactive"
              name="icon-xiaohongshubiaoti"
              size={24}
              onClick={() => {
                ClipboardHelper.write(nodeName);
              }}
            />
          </Tooltip>
          {showSaveButton && (
            <>
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
            </>
          )}
        </div>

        <Modal
          title="保存为模板"
          open={saveModalVisible}
          onOk={handleSaveConfirm}
          onCancel={() => setSaveModalVisible(false)}
          okText="保存"
          cancelText="取消"
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              是否将当前节点保存为自定义模板？
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ flexShrink: 0, fontSize: 14 }}>模板名</label>
              <Input
                placeholder="请输入模板名称"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onPressEnter={handleSaveConfirm}
                maxLength={30}
              />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            节点类型：Pipeline
          </div>
          <div style={{ fontSize: 12, color: "#999" }}>
            提示：保存后可从右键模板列表中选择已保存的模板
          </div>
        </Modal>
      </>
    );
  }
);
