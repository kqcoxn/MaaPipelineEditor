import { memo, useCallback, useState } from "react";
import { Button, message, Modal } from "antd";
import {
  useConfigStore,
  getExportableConfigs,
  globalConfig,
} from "../../../stores/configStore";
import { useCustomTemplateStore } from "../../../stores/customTemplateStore";
import { useFlowStore } from "../../../stores/flow";
import { localServer } from "../../../services";
import { OpenAIChat } from "../../../utils/ai/openai";
import { SYSTEM_PROMPTS } from "../../../utils/ai/aiPrompts";
import { BackendConfigModal } from "../../modals";
import FieldSortModal from "../../modals/FieldSortModal";
import { HANDLE_DIRECTION_OPTIONS } from "../../flow/nodes/constants";

/**一键更改所有节点端点位置 */
const ApplyToAllRenderer = memo(() => {
  const defaultHandleDirection = useConfigStore(
    (state) => state.configs.defaultHandleDirection,
  );
  const nodes = useFlowStore((state) => state.nodes);
  const setNodes = useFlowStore((state) => state.setNodes);

  const handleApplyToAll = useCallback(() => {
    const newNodes = nodes.map((node) => ({
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
      `已将所有节点端点位置更改为「${
        HANDLE_DIRECTION_OPTIONS.find((o) => o.value === defaultHandleDirection)
          ?.label
      }」`,
    );
  }, [nodes, setNodes, defaultHandleDirection]);

  return (
    <Button size="small" onClick={handleApplyToAll}>
      应用到所有节点
    </Button>
  );
});

/**字段排序配置 */
const FieldSortRenderer = memo(() => {
  const setStatus = useConfigStore((state) => state.setStatus);

  return (
    <>
      <Button
        size="small"
        onClick={() => setStatus("showFieldSortModal", true)}
      >
        配置排序
      </Button>
      <FieldSortModal />
    </>
  );
});

/**本地服务配置（醒目卡片） */
const BackendConfigRenderer = memo(() => {
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
        }}
        onClick={() => {
          if (!isConnected) {
            message.warning("请先连接本地服务");
            return;
          }
          setOpen(true);
        }}
      >
        <div style={{ fontWeight: 500, marginBottom: 4 }}>打开后端配置</div>
        <div style={{ fontSize: 12, color: "var(--ant-color-text-secondary)" }}>
          {isConnected
            ? "查看和修改后端服务的配置，包括服务器、文件、日志、MaaFramework 等设置"
            : "需要先连接本地服务才能打开"}
        </div>
      </div>
      <BackendConfigModal open={open} onClose={() => setOpen(false)} />
    </>
  );
});

/**AI 警告框 */
const AIWarningRenderer = memo(() => (
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
    ⚠️ API Key 将以明文存储在浏览器本地（LocalStorage），请勿在公共设备上使用！
    <br />
    ⚠️ 浏览器直接调用 API 可能遇到 CORS 跨域限制，建议使用支持 CORS 的 API
    中转服务
    <br />
    💡 节点预测功能需要支持视觉的模型（如 GPT-4o、Claude-3.5-Sonnet、Qwen-VL
    等）
  </div>
));

/**测试 AI 连接 */
const TestConnectionRenderer = memo(() => {
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const chat = new OpenAIChat({
        systemPrompt: SYSTEM_PROMPTS.TEST_CONNECTION,
      });
      const result = await chat.send("直接回复：AI 服务连接成功");
      if (result.success) {
        message.success(`测试成功: ${result.content}`);
      } else {
        message.error(`测试失败: ${result.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="small" type="primary" loading={loading} onClick={handleTest}>
      测试连接
    </Button>
  );
});

/**导出配置 */
const ExportConfigRenderer = memo(() => {
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
        ? `配置导出成功（包含 ${templateCount} 个自定义模板）`
        : "配置导出成功";
    message.success(msg);
  };

  return (
    <Button size="small" onClick={handleExport}>
      导出
    </Button>
  );
});

/**导入配置 */
const ImportConfigRenderer = memo(() => {
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
          message.error("无效的配置文件格式");
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
          message.success(`配置导入成功（包含 ${templateCount} 个自定义模板）`);
        } else if (templateCount > 0 && !templateImportSuccess) {
          message.warning("配置导入成功，但自定义模板导入失败");
        } else {
          message.success("配置导入成功");
        }
      } catch {
        message.error("配置文件解析失败");
      }
    };
    input.click();
  };

  return (
    <Button size="small" onClick={handleImport}>
      导入
    </Button>
  );
});

/**重置默认值 */
const ResetDefaultsRenderer = memo(() => {
  const resetAllConfigs = useConfigStore((state) => state.resetAllConfigs);

  const handleReset = () => {
    Modal.confirm({
      title: "重置所有配置",
      content: "确定要将所有配置项恢复为默认值吗？此操作不可撤销。",
      okText: "确定重置",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        resetAllConfigs();
        message.success("已恢复默认配置");
      },
    });
  };

  return (
    <Button size="small" danger onClick={handleReset}>
      重置默认值
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
