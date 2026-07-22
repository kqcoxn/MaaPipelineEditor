import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { memo, useMemo, useState, useCallback } from "react";
import {
  useToolbarStore,
  type ExportAction,
} from "../../../stores/toolbarStore";
import { useConfigStore } from "../../../stores/configStore";
import { useProjectSessionStore } from "../../../stores/projectSessionStore";
import { useFlowStore } from "../../../stores/flow";
import { useShallow } from "zustand/shallow";
import { flowToPipeline, flowToSeparatedStrings } from "../../../core/parser";
import { ClipboardHelper } from "../../../utils/ui/clipboard";
import { ExportFileModal } from "../../modals/ExportFileModal";
import { checkGuard } from "../../panels/settings/guardSystem";
import GuardPromptModal from "../../modals/GuardPromptModal";
import type { ConfigItemDef } from "../../panels/settings/settingsDefinitions";
import style from "../../../styles/panels/ToolbarPanel.module.less";
import { getCapability } from "../../../features/project-storage/ProjectStorageAdapter";
import {
  saveActiveEditor,
  saveAllDocuments,
} from "../../../services/editorCommands";

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
  const defaultExportAction = useToolbarStore((state) => state.defaultExportAction);
  const setDefaultExportAction = useToolbarStore(
    (state) => state.setDefaultExportAction,
  );
  const exportModalVisible = useToolbarStore((state) => state.exportDialogOpen);
  const openExportDialog = useToolbarStore((state) => state.openExportDialog);
  const closeExportDialog = useToolbarStore((state) => state.closeExportDialog);
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode,
  );
  const activeDocumentId = useProjectSessionStore(
    (state) => state.activeDocumentId,
  );
  const activeEntry = useProjectSessionStore((state) =>
    state.activeDocumentId
      ? state.entriesById[state.activeDocumentId]
      : undefined,
  );
  const storageCapabilities = useProjectSessionStore(
    (state) => state.capabilities,
  );
  const canSaveToProject = Boolean(
    activeDocumentId &&
      activeEntry &&
      "path" in activeEntry &&
      getCapability(storageCapabilities, "write").available,
  );
  const { selectedNodes, selectedEdges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.debouncedSelectedNodes,
      selectedEdges: state.debouncedSelectedEdges,
    })),
  );

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
      successMsg: "已将 Pipeline 导出到粘贴板",
    });
  };

  const handleExportToFile = useCallback(() => {
    openExportDialog();
  }, [openExportDialog]);

  const handleSaveToProject = useCallback(() => {
    void saveActiveEditor();
  }, []);

  const handlePartialExport = useCallback(() => {
    ClipboardHelper.write(
      flowToPipeline({
        nodes: selectedNodes,
        edges: selectedEdges,
      }),
      { successMsg: "已将选中节点 Pipeline 导出到粘贴板" },
    );
  }, [selectedEdges, selectedNodes]);

  const handleExportPipeline = () => {
    const { pipelineString } = flowToSeparatedStrings();
    ClipboardHelper.writeString(pipelineString, {
      successMsg: "已将 Pipeline 导出到粘贴板",
    });
  };

  const handleSaveAllDocuments = useCallback(() => {
    void saveAllDocuments();
  }, []);

  const handleExportConfig = () => {
    const { configString } = flowToSeparatedStrings();
    ClipboardHelper.writeString(configString, {
      successMsg: "已将配置导出到粘贴板",
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
      case "save-local-pipeline":
      case "save-local-config":
        handleSaveToProject();
        break;
      case "save-local-all":
        handleSaveAllDocuments();
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
    }
  }, [
    handleExportToFile,
    handlePartialExport,
    handleSaveAllDocuments,
    handleSaveToProject,
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
        label: "导出到粘贴板",
        onClick: () => {
          setDefaultExportAction("clipboard");
          executeExportAction("clipboard");
        },
      },
      {
        key: "file",
        label: "导出为文件",
        onClick: () => {
          setDefaultExportAction("file");
          executeExportAction("file");
        },
      },
    ];

    if (canSaveToProject) {
      items.push({
        key: "save-local",
        label: "保存当前文档",
        onClick: () => {
          setDefaultExportAction("save-local");
          executeExportAction("save-local");
        },
      });
      items.push({
        key: "save-local-all",
        label: "保存全部已修改文档",
        onClick: () => {
          setDefaultExportAction("save-local-all");
          executeExportAction("save-local-all");
        },
      });
    }

    // 仅在有选中节点时显示
    if (isPartable) {
      items.push(
        { type: "divider" },
        {
          key: "partial",
          label: "部分导出",
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
          label: "导出 Pipeline",
          onClick: () => {
            setDefaultExportAction("export-pipeline");
            executeExportAction("export-pipeline");
          },
        },
        {
          key: "export-config",
          label: "导出配置",
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
    canSaveToProject,
    isPartable,
    executeExportAction,
    setDefaultExportAction,
  ]);

  // 获取按钮文本和当前操作描述
  const { buttonLabel, currentActionDesc } = useMemo(() => {
    switch (defaultExportAction) {
      case "clipboard":
        return { buttonLabel: "导出", currentActionDesc: "粘贴板" };
      case "file":
        return { buttonLabel: "导出", currentActionDesc: "文件" };
      case "save-local":
        return { buttonLabel: "保存", currentActionDesc: "当前" };
      case "save-local-all":
        return { buttonLabel: "保存", currentActionDesc: "全部" };
      case "save-local-pipeline":
        return { buttonLabel: "导出", currentActionDesc: "Pipeline" };
      case "save-local-config":
        return { buttonLabel: "导出", currentActionDesc: "配置" };
      case "partial":
        return { buttonLabel: "导出", currentActionDesc: "部分" };
      case "export-pipeline":
        return { buttonLabel: "导出", currentActionDesc: "Pipeline" };
      case "export-config":
        return { buttonLabel: "导出", currentActionDesc: "配置" };
      default:
        return { buttonLabel: "导出", currentActionDesc: "粘贴板" };
    }
  }, [defaultExportAction]);

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
            {buttonLabel}（{currentActionDesc}）
          </Button>
        </Dropdown>
      </div>
      <ExportFileModal
        visible={exportModalVisible}
        onCancel={closeExportDialog}
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
