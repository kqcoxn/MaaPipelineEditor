import { memo, useState, useCallback } from "react";
import { Tooltip, message, notification } from "antd";
import IconFont from "../../../iconfonts";
import type {
  NodeType,
  PipelineNodeDataType,
} from "../../../../stores/flow/types";
import { useConfigStore } from "../../../../stores/configStore";
import { NodeTypeEnum } from "../../../flow/nodes";
import {
  collectNodeContext,
  predictNodeConfig,
  applyPrediction,
} from "../../../../utils/ai/aiPredictor";
import { useFlowStore } from "../../../../stores/flow";
import { useMFWStore } from "../../../../stores/mfwStore";
import {
  copyNodeName,
  saveNodeAsTemplate,
  copyNodeRecoJSON,
} from "../../../flow/nodes/utils/nodeOperations";
import { crossFileService } from "../../../../services/crossFileService";
import { WikiPonderTrigger } from "../../../../features/wiki/components/WikiPonderTrigger";
import type { WikiTarget } from "../../../../wiki/types";

// 左侧工具栏
export const FieldPanelToolbarLeft = memo(
  ({
    currentNode,
    onEditJson,
  }: {
    currentNode: NodeType | null;
    onEditJson?: () => void;
  }) => {
    const showCopyRecoButton =
      currentNode && currentNode.type === NodeTypeEnum.Pipeline;

    const handleCopyNodeName = () => {
      const pureNodeName = currentNode?.data.label || "";
      const nodeType = currentNode?.type;
      copyNodeName(pureNodeName, nodeType);
    };

    const handleCopyRecoJSON = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }
      copyNodeRecoJSON(currentNode.id);
    };

    const handleEditJson = () => {
      if (!currentNode) return;
      onEditJson?.();
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
        {currentNode && (
          <Tooltip placement="top" title="编辑 JSON">
            <IconFont
              className="icon-interactive"
              name="icon-JSON"
              size={22}
              onClick={handleEditJson}
            />
          </Tooltip>
        )}
        <WikiPonderTrigger
          target={{ entryId: "workflow", moduleId: "field-panel" }}
          title="字段面板"
          description="查看字段面板的关键字段、邻接信息和图像类字段配置思路。"
          placement="top"
        />
      </div>
    );
  },
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

    const showPipelineButtons =
      currentNode && currentNode.type === NodeTypeEnum.Pipeline;

    // 跳转按钮
    const showNavigateButton =
      currentNode &&
      (currentNode.type === NodeTypeEnum.External ||
        currentNode.type === NodeTypeEnum.Anchor);

    const { connectionStatus, controllerId } = useMFWStore();
    const { aiApiUrl, aiApiKey, aiModel } = useConfigStore(
      (state) => state.configs,
    );
    const aiReady =
      connectionStatus === "connected" &&
      !!controllerId &&
      !!aiApiUrl &&
      !!aiApiKey &&
      !!aiModel;
    const aiWikiTarget: WikiTarget = aiReady
      ? { entryId: "ai", moduleId: "assist" }
      : { entryId: "ai", moduleId: "prerequisites" };
    const aiWikiTitle = aiReady ? "AI 辅助" : "AI 前置条件";
    const aiWikiDescription = aiReady
      ? "节点预测适合补当前节点配置，最终字段仍应回到面板和工具箱里核对。"
      : "节点预测依赖设备连接、截图来源和 AI API 配置，这三类前置条件缺一不可。";

    const handleSaveTemplate = () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }
      saveNodeAsTemplate(
        currentNode.data.label,
        currentNode.data as PipelineNodeDataType,
      );
    };

    // 跳转到目标节点
    const handleNavigate = useCallback(async () => {
      if (
        !currentNode ||
        (currentNode.type !== NodeTypeEnum.External &&
          currentNode.type !== NodeTypeEnum.Anchor)
      ) {
        return;
      }

      const label = currentNode.data.label;
      if (!label) {
        message.warning("节点名为空");
        return;
      }

      const result = await crossFileService.navigateToNodeByName(label, {
        crossFile: true,
        excludeTypes: [NodeTypeEnum.External, NodeTypeEnum.Anchor],
      });

      if (result.success) {
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    }, [currentNode]);

    // 处理AI预测
    const handleAIPredict = async () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }

      // 检查前置条件
      if (connectionStatus !== "connected" || !controllerId) {
        message.error("请先连接到本地服务与设备");
        return;
      }

      // 检查 AI 配置
      if (!aiApiUrl || !aiApiKey || !aiModel) {
        message.error("请先在配置面板中设置 AI API");
        return;
      }

      try {
        setAiPredicting(true);
        onLoadingChange?.(true);

        const nodes = useFlowStore.getState().nodes;
        const edges = useFlowStore.getState().edges;

        // 收集节点上下文（截图 + 前置节点）
        const context = await collectNodeContext(
          currentNode.id,
          nodes,
          edges,
          onProgressChange,
        );

        // 检查截图是否成功
        if (!context.screenshot) {
          message.error("截图获取失败，请检查设备连接");
          return;
        }

        // 调用AI预测（Vision 模式）
        const prediction = await predictNodeConfig(context, onProgressChange);

        // 应用预测结果
        onProgressChange?.("应用配置", "正在填充节点字段...");
        const result = applyPrediction(currentNode.id, prediction);

        if (result.filledCount > 0) {
          message.success(
            `已成功填充 ${result.filledCount} 个字段，可在AI对话历史中查看详细推理依据`,
          );

          // 显示需要验证的字段提示
          if (result.validationHints.length > 0) {
            notification.warning({
              message: "以下字段需要手动验证",
              description: (
                <div>
                  <p style={{ marginBottom: 8 }}>
                    AI 无法准确预测这些字段的值，请使用字段工具验证：
                  </p>
                  {result.validationHints.map((hint, idx) => (
                    <div key={idx} style={{ marginBottom: 4 }}>
                      <strong>{hint.category}</strong>: {hint.fields.join(", ")}
                      <span style={{ color: "#666", marginLeft: 8 }}>
                        — {hint.reason}
                      </span>
                    </div>
                  ))}
                </div>
              ),
              duration: 8,
              placement: "bottomRight",
            });
          }
        } else {
          message.info(
            "AI分析完成，但没有需要填充的字段，可在AI对话历史中查看推理依据",
          );
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "AI预测失败";

        // 根据错误类型给出不同提示
        if (errorMsg.includes("未连接") || errorMsg.includes("截图")) {
          message.error("截图失败，请确保设备已连接");
        } else if (errorMsg.includes("API") || errorMsg.includes("配置")) {
          message.error("请先在配置面板中设置AI API");
        } else if (errorMsg.includes("视觉") || errorMsg.includes("vision")) {
          message.error(
            "当前模型不支持视觉功能，请使用支持视觉的模型（如 GPT-4o）",
          );
        } else {
          message.error(`AI预测失败: ${errorMsg}`);
        }

        console.error("AI预测失败:", err);
      } finally {
        setAiPredicting(false);
        onLoadingChange?.(false);
      }
    };

    if (!showPipelineButtons && !showNavigateButton) {
      return null;
    }

    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {showNavigateButton && (
          <Tooltip placement="top" title="跳转到目标节点">
            <IconFont
              className="icon-interactive"
              name="icon-qianjin"
              size={20}
              onClick={handleNavigate}
            />
          </Tooltip>
        )}
        {showPipelineButtons && (
          <>
            <Tooltip placement="top" title="保存为模板">
              <IconFont
                className="icon-interactive"
                name="icon-biaodanmoban"
                size={24}
                onClick={handleSaveTemplate}
              />
            </Tooltip>
            <WikiPonderTrigger
              target={{ entryId: "toolbox", moduleId: "template-screenshot" }}
              title="模板截图"
              description="模板、ROI、OCR 与偏移字段建议围绕同一张截图来配置。"
              placement="top"
            />
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
            <WikiPonderTrigger
              target={aiWikiTarget}
              title={aiWikiTitle}
              description={aiWikiDescription}
              placement="top"
            />
            <Tooltip placement="top" title="删除节点">
              <IconFont
                className="icon-interactive"
                name="icon-shanchu"
                size={19}
                color="#ff4a4a"
                onClick={onDelete}
              />
            </Tooltip>
          </>
        )}
      </div>
    );
  },
);
