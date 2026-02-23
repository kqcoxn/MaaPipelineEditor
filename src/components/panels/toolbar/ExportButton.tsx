import { Button, Dropdown, message } from "antd";
import type { MenuProps } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { memo, useMemo, useState } from "react";
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
import { ClipboardHelper } from "../../../utils/clipboard";
import { ExportFileModal } from "../../modals/ExportFileModal";
import { CreateFileModal } from "../../modals/CreateFileModal";
import style from "../../../styles/ToolbarPanel.module.less";

/**
 * 导出按钮组件
 * 支持导出到粘贴板或文件,点击执行默认操作,悬停显示菜单
 */
function ExportButton() {
  const { defaultExportAction, setDefaultExportAction } = useToolbarStore();
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode
  );
  const wsConnected = useWSStore((state) => state.connected);
  const currentFilePath = useFileStore(
    (state) => state.currentFile.config.filePath
  );
  const saveFileToLocal = useFileStore((state) => state.saveFileToLocal);
  const { selectedNodes, selectedEdges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.debouncedSelectedNodes,
      selectedEdges: state.debouncedSelectedEdges,
    }))
  );

  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [createFileModalVisible, setCreateFileModalVisible] = useState(false);
  const isPartable = selectedNodes.length > 0;

  // 导出操作处理
  const handleExportToClipboard = () => {
    ClipboardHelper.write(flowToPipeline(), {
      successMsg: "已将 Pipeline 导出到粘贴板",
    });
  };

  const handleExportToFile = () => {
    setExportModalVisible(true);
  };

  const handleSaveToLocal = async () => {
    const success = await saveFileToLocal();
    if (!success) {
      message.error("文件保存失败");
    }
  };

  const handleCreateFileWithLocal = () => {
    setCreateFileModalVisible(true);
  };

  const handlePartialExport = () => {
    ClipboardHelper.write(
      flowToPipeline({
        nodes: selectedNodes,
        edges: selectedEdges,
      }),
      { successMsg: "已将选中节点 Pipeline 导出到粘贴板" }
    );
  };

  const handleExportPipeline = () => {
    const { pipelineString } = flowToSeparatedStrings();
    ClipboardHelper.writeString(pipelineString, {
      successMsg: "已将 Pipeline 导出到粘贴板",
    });
  };

  const handleExportConfig = () => {
    const { configString } = flowToSeparatedStrings();
    ClipboardHelper.writeString(configString, {
      successMsg: "已将配置导出到粘贴板",
    });
  };

  // 执行对应的导出操作
  const executeExportAction = (action: ExportAction) => {
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
  };

  // 点击按钮执行默认操作
  const handleButtonClick = () => {
    executeExportAction(defaultExportAction);
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

    // 仅在已连接本地服务且存在当前文件路径时显示
    if (wsConnected && currentFilePath) {
      items.push({
        key: "save-local",
        label: "保存到本地",
        onClick: () => {
          setDefaultExportAction("save-local");
          executeExportAction("save-local");
        },
      });
    }

    // 仅在已连接本地服务时显示
    if (wsConnected) {
      items.push({
        key: "create-local",
        label: "使用本地服务创建",
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
          label: "部分导出",
          onClick: () => {
            setDefaultExportAction("partial");
            executeExportAction("partial");
          },
        }
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
        }
      );
    }

    return items;
  }, [
    configHandlingMode,
    wsConnected,
    currentFilePath,
    isPartable,
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
        return { buttonLabel: "导出", currentActionDesc: "本地" };
      case "partial":
        return { buttonLabel: "导出", currentActionDesc: "部分" };
      case "export-pipeline":
        return { buttonLabel: "导出", currentActionDesc: "Pipeline" };
      case "export-config":
        return { buttonLabel: "导出", currentActionDesc: "配置" };
      case "create-local":
        return { buttonLabel: "导出", currentActionDesc: "本地创建" };
      default:
        return { buttonLabel: "导出", currentActionDesc: "粘贴板" };
    }
  }, [defaultExportAction]);

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["hover"]}
        placement="bottomLeft"
        overlayClassName="toolbar-dropdown"
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
      <ExportFileModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
      />
      <CreateFileModal
        visible={createFileModalVisible}
        onCancel={() => setCreateFileModalVisible(false)}
      />
    </>
  );
}

export default memo(ExportButton);
