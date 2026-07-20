import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, message, Modal } from "antd";
import {
  useConfigStore,
  getExportableConfigs,
  globalConfig,
} from "../../../stores/configStore";
import { useCustomTemplateStore } from "../../../stores/customTemplateStore";
import { useFlowStore } from "../../../stores/flow";
import { localServer } from "../../../services";
import { AIClient } from "../../../utils/ai/aiClient";
import { SYSTEM_PROMPTS } from "../../../utils/ai/aiPrompts";
import { BackendConfigModal } from "../../modals";
import FieldSortModal from "../../modals/FieldSortModal";
import { HANDLE_DIRECTION_OPTIONS } from "../../flow/nodes/constants";

/**一键更改所有节点端点位置 */
const ApplyToAllRenderer = memo(() => {
  const { t } = useTranslation();
  const defaultHandleDirection = useConfigStore(
    (state) => state.configs.defaultHandleDirection,
  );
  const setNodes = useFlowStore((state) => state.setNodes);

  const handleApplyToAll = useCallback(() => {
    const newNodes = useFlowStore.getState().nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        handleDirection:
          defaultHandleDirection === "left-right"
            ? undefined
            : defaultHandleDirection,
      },
    }));
    setNodes(newNodes);
    message.success(
      t("ui.panels.settings.applyToAllSuccess", "已将所有节点端点位置更改为「{{direction}}」", {
        direction:
          HANDLE_DIRECTION_OPTIONS.find((o) => o.value === defaultHandleDirection)
            ?.label ?? "",
      }),
    );
  }, [setNodes, defaultHandleDirection, t]);

  return (
    <Button size="small" onClick={handleApplyToAll}>
      {t("ui.panels.settings.applyToAll", "应用到所有节点")}
    </Button>
  );
});

/**字段排序配置 */
const FieldSortRenderer = memo(() => {
  const { t } = useTranslation();
  const setStatus = useConfigStore((state) => state.setStatus);

  return (
    <>
      <Button
        size="small"
        onClick={() => setStatus("showFieldSortModal", true)}
      >
        {t("ui.panels.settings.configureSort", "配置排序")}
      </Button>
      <FieldSortModal />
    </>
  );
});

/**本地服务配置（醒目卡片） */
const BackendConfigRenderer = memo(() => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isConnected = localServer.isConnected();

  return (
    <>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: `1px solid ${isConnected ? "var(--ant-color-border-secondary)" : "var(--ant-color-warning-border)"}`,
          background: isConnected
            ? "var(--ant-color-bg-layout)"
            : "var(--ant-color-warning-bg)",
          cursor: "pointer",
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={() => {
          if (!isConnected) {
            message.warning(
              t("ui.panels.settings.connectLocalFirst", "请先连接本地服务"),
            );
            return;
          }
          setOpen(true);
        }}
      >
        <div style={{ fontWeight: 500 }}>
          {t("ui.panels.settings.editBackendConfig", "编辑后端配置")}
        </div>
        {!isConnected && (
          <div
            style={{
              fontSize: 12,
              color: "var(--ant-color-text-secondary)",
              marginTop: 4,
            }}
          >
            {t(
              "ui.panels.settings.needLocalConnection",
              "需要先连接本地服务才能打开",
            )}
          </div>
        )}
      </div>
      <BackendConfigModal open={open} onClose={() => setOpen(false)} />
    </>
  );
});

/**AI 警告框 */
const AIWarningRenderer = memo(() => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        fontSize: 12,
        color: "#ff7875",
        padding: "8px 12px",
        background: "#fff2f0",
        borderRadius: 8,
        lineHeight: 1.5,
        width: "100%",
      }}
    >
      {t(
        "ui.panels.settings.aiWarningLine1",
        "🌐 开启 LocalBridge 代理可解决 CORS 跨域限制，关闭则需要 API 服务支持 CORS",
      )}
      <br />
      {t(
        "ui.panels.settings.aiWarningLine2",
        "💡 节点预测功能需要支持视觉的模型（如 GPT-4o、Claude Sonnet、Gemini Flash 等）",
      )}
      <br />
      {t(
        "ui.panels.settings.aiWarningLine3",
        "🔐 API Key 粘贴后会自动加密存储，显示为 ENC: 开头的密文属于正常现象",
      )}
    </div>
  );
});

/**测试 AI 连接 */
const TestConnectionRenderer = memo(() => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const chat = new AIClient({
        systemPrompt: SYSTEM_PROMPTS.TEST_CONNECTION,
      });
      const result = await chat.send(
        t("ui.panels.settings.testConnectionPrompt", "直接回复：AI 服务连接成功"),
      );
      if (result.success) {
        message.success(
          t("ui.panels.settings.testSuccess", "测试成功: {{content}}", {
            content: result.content,
          }),
        );
      } else {
        message.error(
          t("ui.panels.settings.testFailed", "测试失败: {{error}}", {
            error: result.error,
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="small" type="primary" loading={loading} onClick={handleTest}>
      {t("ui.panels.settings.testConnection", "测试连接")}
    </Button>
  );
});

/**导出配置 */
const ExportConfigRenderer = memo(() => {
  const { t } = useTranslation();
  const configs = useConfigStore((state) => state.configs);
  const exportTemplates = useCustomTemplateStore(
    (state) => state.exportTemplates,
  );

  const handleExport = () => {
    const exportableConfigs = getExportableConfigs(configs, []);
    const customTemplates = exportTemplates();

    const exportData = {
      version: globalConfig.version,
      exportTime: new Date().toISOString(),
      configs: exportableConfigs,
      customTemplates: customTemplates,
    };

    const indent = useConfigStore.getState().configs.jsonIndent;
    const blob = new Blob([JSON.stringify(exportData, null, indent)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpe-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const templateCount = customTemplates.length;
    const msg =
      templateCount > 0
        ? t(
            "ui.panels.settings.exportSuccessWithTemplates",
            "配置导出成功（包含 {{count}} 个自定义模板）",
            { count: templateCount },
          )
        : t("ui.panels.settings.exportSuccess", "配置导出成功");
    message.success(msg);
  };

  return (
    <Button size="small" onClick={handleExport}>
      {t("ui.panels.settings.export", "导出")}
    </Button>
  );
});

/**导入配置 */
const ImportConfigRenderer = memo(() => {
  const { t } = useTranslation();
  const replaceConfig = useConfigStore((state) => state.replaceConfig);
  const importTemplates = useCustomTemplateStore(
    (state) => state.importTemplates,
  );

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.configs || typeof data.configs !== "object") {
          message.error(
            t("ui.panels.settings.invalidConfigFormat", "无效的配置文件格式"),
          );
          return;
        }

        replaceConfig(data.configs);

        let templateImportSuccess = false;
        let templateCount = 0;
        if (data.customTemplates && Array.isArray(data.customTemplates)) {
          templateCount = data.customTemplates.length;
          templateImportSuccess = importTemplates(data.customTemplates);
        }

        if (templateCount > 0 && templateImportSuccess) {
          message.success(
            t(
              "ui.panels.settings.importSuccessWithTemplates",
              "配置导入成功（包含 {{count}} 个自定义模板）",
              { count: templateCount },
            ),
          );
        } else if (templateCount > 0 && !templateImportSuccess) {
          message.warning(
            t(
              "ui.panels.settings.importSuccessTemplatesFailed",
              "配置导入成功，但自定义模板导入失败",
            ),
          );
        } else {
          message.success(
            t("ui.panels.settings.importSuccess", "配置导入成功"),
          );
        }
      } catch {
        message.error(
          t("ui.panels.settings.importParseFailed", "配置文件解析失败"),
        );
      }
    };
    input.click();
  };

  return (
    <Button size="small" onClick={handleImport}>
      {t("ui.panels.settings.import", "导入")}
    </Button>
  );
});

/**重置默认值 */
const ResetDefaultsRenderer = memo(() => {
  const { t } = useTranslation();
  const resetAllConfigs = useConfigStore((state) => state.resetAllConfigs);

  const handleReset = () => {
    Modal.confirm({
      title: t("ui.panels.settings.resetAllTitle", "重置所有配置"),
      content: t(
        "ui.panels.settings.resetAllContent",
        "确定要将所有配置项恢复为默认值吗？此操作不可撤销。",
      ),
      okText: t("ui.panels.settings.resetConfirm", "确定重置"),
      okType: "danger",
      cancelText: t("ui.panels.settings.cancel", "取消"),
      onOk: () => {
        resetAllConfigs();
        message.success(
          t("ui.panels.settings.resetSuccess", "已恢复默认配置"),
        );
      },
    });
  };

  return (
    <Button size="small" danger onClick={handleReset}>
      {t("ui.panels.settings.resetDefaults", "重置默认值")}
    </Button>
  );
});

/**自定义渲染器注册表 */
export const customRenderers: Record<string, React.FC> = {
  applyToAll: ApplyToAllRenderer,
  fieldSort: FieldSortRenderer,
  backendConfig: BackendConfigRenderer,
  aiWarning: AIWarningRenderer,
  testConnection: TestConnectionRenderer,
  exportConfig: ExportConfigRenderer,
  importConfig: ImportConfigRenderer,
  resetDefaults: ResetDefaultsRenderer,
};
