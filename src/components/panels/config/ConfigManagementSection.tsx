import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Button, message } from "antd";
import classNames from "classnames";

import {
  useConfigStore,
  getExportableConfigs,
  globalConfig,
} from "../../../stores/configStore";
import TipElem from "./TipElem";

const ConfigManagementSection = memo(() => {
  const configs = useConfigStore((state) => state.configs);
  const replaceConfig = useConfigStore((state) => state.replaceConfig);

  const globalClass = useMemo(() => classNames(style.item, style.global), []);

  // 导出配置
  const handleExportConfig = () => {
    // 获取可导出的配置
    const exportableConfigs = getExportableConfigs(configs, []);
    const exportData = {
      version: globalConfig.version,
      exportTime: new Date().toISOString(),
      configs: exportableConfigs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpe-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("配置导出成功");
  };

  // 导入配置
  const handleImportConfig = () => {
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
        message.success("配置导入成功");
      } catch (err) {
        message.error("配置文件解析失败");
      }
    };
    input.click();
  };

  return (
    <>
      <div className={style.divider}>—————— 配置管理 ——————</div>
      {/* 导出导入配置 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="导出/导入配置"
            content={
              <TipElem
                content={
                  '导出当前设置为 JSON 文件，或从 JSON 文件导入设置。注意："文件配置"（节点前缀、文件路径）不会被导出/导入。'
                }
              />
            }
          >
            <span>导出/导入</span>
          </Popover>
        </div>
        <div className={style.value} style={{ display: "flex", gap: 4 }}>
          <Button size="small" onClick={handleExportConfig}>
            导出
          </Button>
          <Button size="small" onClick={handleImportConfig}>
            导入
          </Button>
        </div>
      </div>
    </>
  );
});

export default ConfigManagementSection;
