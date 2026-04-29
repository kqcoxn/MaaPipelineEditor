import { Button, Dropdown, message } from "antd";
import type { MenuProps } from "antd";
import { ImportOutlined } from "@ant-design/icons";
import { memo, useMemo, useRef } from "react";
import {
  useToolbarStore,
  type ImportAction,
} from "../../../stores/toolbarStore";
import { useConfigStore } from "../../../stores/configStore";
import { useWSStore } from "../../../stores/wsStore";
import { pipelineToFlow, mergePipelineAndConfig } from "../../../core/parser";
import { ClipboardHelper } from "../../../utils/ui/clipboard";
import { flowToPipeline } from "../../../core/parser";
import style from "../../../styles/panels/ToolbarPanel.module.less";

const resolveAvailableImportAction = (
  action: ImportAction,
  configHandlingMode: string,
): ImportAction => {
  if (
    configHandlingMode !== "separated" &&
    (action === "clipboard-config" || action === "file-config")
  ) {
    return "clipboard-pipeline";
  }

  return action;
};

/**
 * 导入按钮组件
 * 支持从粘贴板或文件导入 Pipeline/配置，连接 LocalBridge 时文件导入唤起本地文件面板
 */
function ImportButton() {
  const { defaultImportAction, setDefaultImportAction } = useToolbarStore();
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode,
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const wsConnected = useWSStore((state) => state.connected);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const configFileInputRef = useRef<HTMLInputElement>(null);
  const effectiveDefaultImportAction = useMemo(
    () =>
      resolveAvailableImportAction(
        defaultImportAction,
        configHandlingMode,
      ),
    [configHandlingMode, defaultImportAction],
  );

  // 导入操作处理
  const handleImportFromClipboard = async () => {
    try {
      const success = await pipelineToFlow();
      if (success) {
        message.success("从粘贴板导入 Pipeline 成功");
      }
    } catch (err) {
      message.error("导入失败,请检查粘贴板内容");
      console.error(err);
    }
  };

  const handleImportFromFile = () => {
    if (wsConnected) {
      setStatus("showLocalFilePanel", true);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleImportConfigFromClipboard = async () => {
    try {
      const text = await ClipboardHelper.read();
      if (!text) {
        message.error("粘贴板内容为空");
        return;
      }
      const mpeConfig = JSON.parse(text);
      const currentPipeline = flowToPipeline();
      const mergedPipeline = mergePipelineAndConfig(currentPipeline, mpeConfig);
      const success = await pipelineToFlow({
        pString: JSON.stringify(mergedPipeline),
      });
      if (success) {
        message.success("从粘贴板导入配置成功");
      }
    } catch (err) {
      message.error("导入配置失败");
      console.error(err);
    }
  };

  const handleImportConfigFromFile = () => {
    configFileInputRef.current?.click();
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const success = await pipelineToFlow({ pString: text });
        if (success) {
          message.success("从文件导入 Pipeline 成功");
        }
      } catch (err) {
        message.error("文件导入失败,请检查文件格式");
        console.error(err);
      }
      e.target.value = "";
    }
  };

  const onConfigFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const mpeConfig = JSON.parse(text);
        const currentPipeline = flowToPipeline();
        const mergedPipeline = mergePipelineAndConfig(
          currentPipeline,
          mpeConfig,
        );
        const success = await pipelineToFlow({
          pString: JSON.stringify(mergedPipeline),
        });
        if (success) {
          message.success("从文件导入配置成功");
        }
      } catch (err) {
        message.error("配置文件导入失败");
        console.error(err);
      }
      e.target.value = "";
    }
  };

  // 执行对应的导入操作
  const executeImportAction = (action: ImportAction) => {
    const availableAction = resolveAvailableImportAction(
      action,
      configHandlingMode,
    );

    switch (availableAction) {
      case "clipboard-pipeline":
        handleImportFromClipboard();
        break;
      case "file-pipeline":
        handleImportFromFile();
        break;
      case "clipboard-config":
        handleImportConfigFromClipboard();
        break;
      case "file-config":
        handleImportConfigFromFile();
        break;
    }
  };

  // 点击按钮执行默认操作
  const handleButtonClick = () => {
    executeImportAction(effectiveDefaultImportAction);
  };

  // 菜单项定义
  const menuItems: MenuProps["items"] = [
    {
      key: "clipboard-pipeline",
      label: "从粘贴板导入 Pipeline",
      onClick: () => {
        setDefaultImportAction("clipboard-pipeline");
        executeImportAction("clipboard-pipeline");
      },
    },
  ];

  menuItems.push({
    key: "file-pipeline",
    label: "从文件导入 Pipeline",
    onClick: () => {
      setDefaultImportAction("file-pipeline");
      executeImportAction("file-pipeline");
    },
  });

  // 仅在分离导出模式下显示配置导入选项
  if (configHandlingMode === "separated") {
    menuItems.push(
      { type: "divider" },
      {
        key: "clipboard-config",
        label: "从粘贴板导入配置",
        onClick: () => {
          setDefaultImportAction("clipboard-config");
          executeImportAction("clipboard-config");
        },
      },
    );

    menuItems.push({
      key: "file-config",
      label: "从文件导入配置",
      onClick: () => {
        setDefaultImportAction("file-config");
        executeImportAction("file-config");
      },
    });
  }

  // 获取按钮文本和当前操作描述
  const { buttonLabel, currentActionDesc } = useMemo(() => {
    switch (effectiveDefaultImportAction) {
      case "clipboard-pipeline":
        return { buttonLabel: "导入", currentActionDesc: "粘贴板" };
      case "file-pipeline":
        return { buttonLabel: "导入", currentActionDesc: "文件" };
      case "clipboard-config":
        return { buttonLabel: "导入", currentActionDesc: "粘贴板配置" };
      case "file-config":
        return { buttonLabel: "导入", currentActionDesc: "配置文件" };
      default:
        return { buttonLabel: "导入", currentActionDesc: "粘贴板" };
    }
  }, [effectiveDefaultImportAction]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.jsonc"
        style={{ display: "none" }}
        onChange={onFileSelect}
      />
      <input
        ref={configFileInputRef}
        type="file"
        accept=".mpe.json"
        style={{ display: "none" }}
        onChange={onConfigFileSelect}
      />
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["hover"]}
        placement="bottomLeft"
        overlayClassName="toolbar-dropdown"
        mouseEnterDelay={0}
      >
        <Button
          icon={<ImportOutlined />}
          onClick={handleButtonClick}
          className={style.toolbarButton}
        >
          {buttonLabel}（{currentActionDesc}）
        </Button>
      </Dropdown>
    </>
  );
}

export default memo(ImportButton);
