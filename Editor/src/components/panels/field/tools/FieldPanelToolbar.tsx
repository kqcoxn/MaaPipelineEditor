import { memo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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

// 左侧工具栏
export const FieldPanelToolbarLeft = memo(
  ({
    currentNode,
    onEditJson,
  }: {
    currentNode: NodeType | null;
    onEditJson?: () => void;
  }) => {
    const { t } = useTranslation();
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
        <Tooltip
          placement="top"
          title={t("ui.panels.field.toolbar.copyNodeName", "复制节点名")}
        >
          <IconFont
            className="icon-interactive"
            name="icon-xiaohongshubiaoti"
            size={24}
            onClick={handleCopyNodeName}
          />
        </Tooltip>
        {showCopyRecoButton && (
          <Tooltip
            placement="top"
            title={t("ui.panels.field.toolbar.copyRecoJson", "复制 Reco JSON")}
          >
            <IconFont
              className="icon-interactive"
              name="icon-kapianshibie"
              size={23}
              onClick={handleCopyRecoJSON}
            />
          </Tooltip>
        )}
        {currentNode && (
          <Tooltip
            placement="top"
            title={t("ui.panels.field.toolbar.editJson", "编辑 JSON")}
          >
            <IconFont
              className="icon-interactive"
              name="icon-JSON"
              size={22}
              onClick={handleEditJson}
            />
          </Tooltip>
        )}
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
    const { t } = useTranslation();
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
        message.warning(
          t("ui.panels.field.toolbar.emptyNodeName", "节点名为空"),
        );
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
    }, [currentNode, t]);

    // 处理AI预测
    const handleAIPredict = async () => {
      if (!currentNode || currentNode.type !== NodeTypeEnum.Pipeline) {
        return;
      }

      // 检查前置条件
      if (connectionStatus !== "connected" || !controllerId) {
        message.error(
          t(
            "ui.panels.field.toolbar.connectLocalFirst",
            "请先连接到本地服务与设备",
          ),
        );
        return;
      }

      // 检查 AI 配置
      if (!aiApiUrl || !aiApiKey || !aiModel) {
        message.error(
          t("ui.panels.field.toolbar.configureAiFirst", "请先在配置面板中设置 AI API"),
        );
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
          message.error(
            t(
              "ui.panels.field.toolbar.screenshotFailed",
              "截图获取失败，请检查设备连接",
            ),
          );
          return;
        }

        // 调用AI预测（Vision 模式）
        const prediction = await predictNodeConfig(context, onProgressChange);

        // 应用预测结果
        onProgressChange?.(
          t("ui.panels.field.toolbar.applyConfig", "应用配置"),
          t("ui.panels.field.toolbar.fillingFields", "正在填充节点字段..."),
        );
        const result = applyPrediction(currentNode.id, prediction);

        if (result.filledCount > 0) {
          message.success(
            t(
              "ui.panels.field.toolbar.filledSuccess",
              "已成功填充 {{count}} 个字段，可在AI对话历史中查看详细推理依据",
              { count: result.filledCount },
            ),
          );

          // 显示需要验证的字段提示
          if (result.validationHints.length > 0) {
            notification.warning({
              title: t(
                "ui.panels.field.toolbar.validationRequiredTitle",
                "以下字段需要手动验证",
              ),
              description: (
                <div>
                  <p style={{ marginBottom: 8 }}>
                    {t(
                      "ui.panels.field.toolbar.validationRequiredDesc",
                      "AI 无法准确预测这些字段的值，请使用字段工具验证：",
                    )}
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
            t(
              "ui.panels.field.toolbar.aiAnalysisNoFill",
              "AI分析完成，但没有需要填充的字段，可在AI对话历史中查看推理依据",
            ),
          );
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : t("ui.panels.field.toolbar.aiPredictFailed", "AI预测失败");

        // 根据错误类型给出不同提示
        if (
          errorMsg.includes(t("ui.panels.field.toolbar.errNotConnected", "未连接")) ||
          errorMsg.includes(t("ui.panels.field.toolbar.errScreenshot", "截图"))
        ) {
          message.error(
            t(
              "ui.panels.field.toolbar.screenshotError",
              "截图失败，请确保设备已连接",
            ),
          );
        } else if (
          errorMsg.includes("API") ||
          errorMsg.includes(
            t("ui.panels.field.toolbar.errConfig", "配置"),
          )
        ) {
          message.error(
            t(
              "ui.panels.field.toolbar.aiConfigError",
              "请先在配置面板中设置AI API",
            ),
          );
        } else if (
          errorMsg.includes(t("ui.panels.field.toolbar.errVision", "视觉")) ||
          errorMsg.includes("vision")
        ) {
          message.error(
            t(
              "ui.panels.field.toolbar.visionNotSupported",
              "当前模型不支持视觉功能，请使用支持视觉的模型（如 GPT-4o）",
            ),
          );
        } else {
          message.error(
            t(
              "ui.panels.field.toolbar.aiPredictFailedWithError",
              "AI预测失败: {{error}}",
              { error: errorMsg },
            ),
          );
        }

        console.error("AI predict failed:", err);
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
          <Tooltip
            placement="top"
            title={t("ui.panels.field.toolbar.navigateToTarget", "跳转到目标节点")}
          >
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
            <Tooltip
              placement="top"
              title={t("ui.panels.field.toolbar.saveAsTemplate", "保存为模板")}
            >
              <IconFont
                className="icon-interactive"
                name="icon-biaodanmoban"
                size={24}
                onClick={handleSaveTemplate}
              />
            </Tooltip>
            <Tooltip
              placement="top"
              title={t(
                "ui.panels.field.toolbar.aiPredictTooltip",
                "AI智能预测节点配置",
              )}
            >
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
            <Tooltip
              placement="top"
              title={t("ui.panels.field.toolbar.deleteNode", "删除节点")}
            >
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
