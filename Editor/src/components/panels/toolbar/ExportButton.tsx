import { Button, Dropdown, message } from "antd";
import type { MenuProps } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { memo, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  useToolbarStore,
  type ExportAction,
} from "../../../stores/toolbarStore";
import { useConfigStore } from "../../../stores/configStore";
import { useFileStore } from "../../../stores/fileStore";
import { useWSStore } from "../../../stores/wsStore";
import { useFlowStore } from "../../../stores/flow";
import { useShallow } from "zustand/shallow";
import { flowToPipeline, flowToSeparatedStrings } from "../../../core/parser";
import { ClipboardHelper } from "../../../utils/ui/clipboard";
import { ExportFileModal } from "../../modals/ExportFileModal";
import { CreateFileModal } from "../../modals/CreateFileModal";
import { checkGuard } from "../../panels/settings/guardSystem";
import GuardPromptModal from "../../modals/GuardPromptModal";
import type { ConfigItemDef } from "../../panels/settings/settingsDefinitions";
import style from "../../../styles/panels/ToolbarPanel.module.less";

const actionGroupStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/**
 * 导出按钮组件
 * 支持导出到粘贴板或文件,点击执行默认操作,悬停显示菜单
 */
function ExportButton() {
  const { t } = useTranslation();
  const { defaultExportAction, setDefaultExportAction } = useToolbarStore();
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode,
  );
  const wsConnected = useWSStore((state) => state.connected);
  const currentFilePath = useFileStore(
    (state) => state.currentFile.config.filePath,
  );
  const saveFileToLocal = useFileStore((state) => state.saveFileToLocal);
  const { selectedNodes, selectedEdges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.debouncedSelectedNodes,
      selectedEdges: state.debouncedSelectedEdges,
    })),
  );

  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [createFileModalVisible, setCreateFileModalVisible] = useState(false);
  const [guardState, setGuardState] = useState<{
    items: ConfigItemDef[];
    onContinue: () => void;
  } | null>(null);
  const isPartable = selectedNodes.length > 0;

  // 守卫检查：导出前确认关键配置已设置
  const withGuardCheck = useCallback((action: () => void) => {
    const result = checkGuard("export");
    if (result.passed) {
      action();
      return;
    }
    setGuardState({
      items: result.unconfiguredItems,
      onContinue: () => {
        setGuardState(null);
        action();
      },
    });
  }, []);

  // 导出操作处理
  const handleExportToClipboard = () => {
    ClipboardHelper.write(flowToPipeline(), {
      successMsg: t(
        "ui.panels.toolbar.export.clipboardSuccess",
        "已将 Pipeline 导出到粘贴板",
      ),
    });
  };

  const handleExportToFile = () => {
    setExportModalVisible(true);
  };

  const handleSaveToLocal = useCallback(
    async (mode?: "all" | "pipeline" | "config") => {
      const success = await saveFileToLocal(undefined, undefined, mode);
      if (!success) {
        message.error(
          t("ui.panels.toolbar.export.saveFailed", "文件保存失败"),
        );
      }
    },
    [saveFileToLocal],
  );

  const handleCreateFileWithLocal = () => {
    setCreateFileModalVisible(true);
  };

  const handlePartialExport = useCallback(() => {
    ClipboardHelper.write(
      flowToPipeline({
        nodes: selectedNodes,
        edges: selectedEdges,
      }),
      { successMsg: t(
        "ui.panels.toolbar.export.partialClipboardSuccess",
        "已将选中节点 Pipeline 导出到粘贴板",
      ) },
    );
  }, [selectedEdges, selectedNodes]);

  const handleExportPipeline = () => {
    const { pipelineString } = flowToSeparatedStrings();
    ClipboardHelper.writeString(pipelineString, {
      successMsg: t(
        "ui.panels.toolbar.export.clipboardSuccess",
        "已将 Pipeline 导出到粘贴板",
      ),
    });
  };

  const handleExportConfig = () => {
    const { configString } = flowToSeparatedStrings();
    ClipboardHelper.writeString(configString, {
      successMsg: t(
        "ui.panels.toolbar.export.configClipboardSuccess",
        "已将配置导出到粘贴板",
      ),
    });
  };

  // 执行对应的导出操作
  const executeExportAction = useCallback((action: ExportAction) => {
    switch (action) {
      case "clipboard":
        handleExportToClipboard();
        break;
      case "file":
        handleExportToFile();
        break;
      case "save-local":
        handleSaveToLocal();
        break;
      case "save-local-all":
        handleSaveToLocal("all");
        break;
      case "save-local-pipeline":
        handleSaveToLocal("pipeline");
        break;
      case "save-local-config":
        handleSaveToLocal("config");
        break;
      case "partial":
        handlePartialExport();
        break;
      case "export-pipeline":
        handleExportPipeline();
        break;
      case "export-config":
        handleExportConfig();
        break;
      case "create-local":
        handleCreateFileWithLocal();
        break;
    }
  }, [
    handlePartialExport,
    handleSaveToLocal,
  ]);

  // 点击按钮执行默认操作
  const handleButtonClick = () => {
    withGuardCheck(() => executeExportAction(defaultExportAction));
  };

  // 菜单项定义
  const menuItems = useMemo<MenuProps["items"]>(() => {
    const items: MenuProps["items"] = [
      {
        key: "clipboard",
        label: t("ui.panels.toolbar.export.toClipboard", "导出到粘贴板"),
        onClick: () => {
          setDefaultExportAction("clipboard");
          executeExportAction("clipboard");
        },
      },
      {
        key: "file",
        label: t("ui.panels.toolbar.export.toFile", "导出为文件"),
        onClick: () => {
          setDefaultExportAction("file");
          executeExportAction("file");
        },
      },
    ];

    // 仅在已连接本地服务且存在当前文件路径时显示
    if (wsConnected && currentFilePath) {
      if (configHandlingMode === "separated") {
        // 分离导出模式下显示子菜单
        items.push({
          key: "save-local-group",
          label: t("ui.panels.toolbar.export.saveLocal", "保存到本地"),
          children: [
            {
              key: "save-local-all",
              label: t("ui.panels.toolbar.export.saveAll", "全部保存"),
              onClick: () => {
                setDefaultExportAction("save-local-all");
                executeExportAction("save-local-all");
              },
            },
            {
              key: "save-local-pipeline",
              label: t(
                "ui.panels.toolbar.export.savePipelineOnly",
                "仅保存 Pipeline",
              ),
              onClick: () => {
                setDefaultExportAction("save-local-pipeline");
                executeExportAction("save-local-pipeline");
              },
            },
            {
              key: "save-local-config",
              label: t(
                "ui.panels.toolbar.export.saveConfigOnly",
                "仅保存配置",
              ),
              onClick: () => {
                setDefaultExportAction("save-local-config");
                executeExportAction("save-local-config");
              },
            },
          ],
        });
      } else {
        items.push({
          key: "save-local",
          label: t("ui.panels.toolbar.export.saveLocal", "保存到本地"),
          onClick: () => {
            setDefaultExportAction("save-local");
            executeExportAction("save-local");
          },
        });
      }
    }

    // 仅在已连接本地服务时显示
    if (wsConnected) {
      items.push({
        key: "create-local",
        label: t(
          "ui.panels.toolbar.export.createWithLocal",
          "使用本地服务创建",
        ),
        onClick: () => {
          setDefaultExportAction("create-local");
          executeExportAction("create-local");
        },
      });
    }

    // 仅在有选中节点时显示
    if (isPartable) {
      items.push(
        { type: "divider" },
        {
          key: "partial",
          label: t("ui.panels.toolbar.export.partial", "部分导出"),
          onClick: () => {
            setDefaultExportAction("partial");
            executeExportAction("partial");
          },
        },
      );
    }

    // 仅在分离导出模式下显示
    if (configHandlingMode === "separated") {
      items.push(
        { type: "divider" },
        {
          key: "export-pipeline",
          label: t(
            "ui.panels.toolbar.export.exportPipeline",
            "导出 Pipeline",
          ),
          onClick: () => {
            setDefaultExportAction("export-pipeline");
            executeExportAction("export-pipeline");
          },
        },
        {
          key: "export-config",
          label: t("ui.panels.toolbar.export.exportConfig", "导出配置"),
          onClick: () => {
            setDefaultExportAction("export-config");
            executeExportAction("export-config");
          },
        },
      );
    }

    return items;
  }, [
    configHandlingMode,
    wsConnected,
    currentFilePath,
    isPartable,
    executeExportAction,
    setDefaultExportAction,
    t,
  ]);

  // 获取按钮文本和当前操作描述
  const { buttonLabel, currentActionDesc } = useMemo(() => {
    const exportLabel = t("ui.panels.toolbar.export.buttonLabel", "导出");
    switch (defaultExportAction) {
      case "clipboard":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionClipboard",
            "粘贴板",
          ),
        };
      case "file":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t("ui.panels.toolbar.export.actionFile", "文件"),
        };
      case "save-local":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t("ui.panels.toolbar.export.actionLocal", "本地"),
        };
      case "save-local-all":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t("ui.panels.toolbar.export.actionAll", "全部"),
        };
      case "save-local-pipeline":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionPipeline",
            "Pipeline",
          ),
        };
      case "save-local-config":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionConfig",
            "配置",
          ),
        };
      case "partial":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionPartial",
            "部分",
          ),
        };
      case "export-pipeline":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionPipeline",
            "Pipeline",
          ),
        };
      case "export-config":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionConfig",
            "配置",
          ),
        };
      case "create-local":
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionLocalCreate",
            "本地创建",
          ),
        };
      default:
        return {
          buttonLabel: exportLabel,
          currentActionDesc: t(
            "ui.panels.toolbar.export.actionClipboard",
            "粘贴板",
          ),
        };
    }
  }, [defaultExportAction, t]);

  return (
    <>
      <div style={actionGroupStyle}>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={["hover"]}
          placement="bottomLeft"
          classNames={{ root: "toolbar-dropdown" }}
          mouseEnterDelay={0}
        >
          <Button
            icon={<ExportOutlined />}
            onClick={handleButtonClick}
            className={style.toolbarButton}
          >
            {t("ui.panels.toolbar.export.buttonWithAction", "{{label}}（{{desc}}）", {
              label: buttonLabel,
              desc: currentActionDesc,
            })}
          </Button>
        </Dropdown>
      </div>
      <ExportFileModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
      />
      <CreateFileModal
        visible={createFileModalVisible}
        onCancel={() => setCreateFileModalVisible(false)}
      />
      {guardState && (
        <GuardPromptModal
          action="export"
          unconfiguredItems={guardState.items}
          onContinue={guardState.onContinue}
          onCancel={() => setGuardState(null)}
        />
      )}
    </>
  );
}

export default memo(ExportButton);
