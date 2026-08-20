import style from "../../../styles/panels/FileConfigPanel.module.less";

import { memo, useCallback, useMemo } from "react";
import { Popover, Input } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";

import { useConfigStore } from "@/stores/app/configStore";
import { useControlledPanelOccupancy } from "../../../hooks/useControlledPanelOccupancy";
import { useFileStore } from "@/stores/project/fileStore";
import { checkRepeatNodeLabelList } from "../../../stores/flow";

function FileConfigPanel() {
  const showFileConfigPanel = useConfigStore(
    (state) => state.status.showFileConfigPanel,
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const closePanel = useCallback(
    () => setStatus("showFileConfigPanel", false),
    [setStatus],
  );
  const panelOpen = useControlledPanelOccupancy(
    "fileConfig",
    showFileConfigPanel,
    closePanel,
  );
  const fileConfig = useFileStore((state) => state.currentFile.config);
  const setFileConfig = useFileStore((state) => state.setFileConfig);

  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": panelOpen,
      }),
    [panelOpen],
  );

  return (
    <div className={panelClass}>
      <div className={classNames("header", style.header)}>
        <div className="title">文件配置</div>
        <div className={style.right}>
          <IconFont
            className="icon-interactive"
            name="icon-dituweizhixinxi_chahao"
            size={20}
            onClick={closePanel}
          />
        </div>
      </div>
      <div className={style.list}>
        {/* 节点前缀 */}
        <div className={style.item}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"节点前缀"}
              content="在所有节点前添加一个前缀,并使用 _ 与节点名连接,防止跨文件节点名重复"
            >
              <span>节点前缀</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            style={{ maxWidth: 160 }}
            value={fileConfig.prefix}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setFileConfig("prefix", e.target.value);
              checkRepeatNodeLabelList();
            }}
          />
        </div>
        {/* 文件路径 */}
        <div className={style.item}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"文件路径"}
              content="本地JSON文件的完整路径,用于与本地服务通信时标识文件。留空则无法使用本地通信功能。例如: D:/path/to/your/pipeline.json"
            >
              <span>文件路径</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            style={{ maxWidth: 160 }}
            value={fileConfig.filePath || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setFileConfig("filePath", e.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(FileConfigPanel);
