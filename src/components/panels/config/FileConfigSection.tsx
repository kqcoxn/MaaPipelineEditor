import style from "../../../styles/ConfigPanel.module.less";

import { memo } from "react";
import { Popover, Input } from "antd";

import { checkRepeatNodeLabelList } from "../../../stores/flow";
import { useFileStore } from "../../../stores/fileStore";
import TipElem from "./TipElem";

const FileConfigSection = memo(() => {
  const fileConfig = useFileStore((state) => state.currentFile.config);
  const setFileConfig = useFileStore((state) => state.setFileConfig);

  return (
    <>
      <div className={style.divider}>—————— 文件配置 ——————</div>
      {/* 节点前缀 */}
      <div className={style.item}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"节点前缀"}
            content={
              <TipElem
                content={
                  "在所有节点前添加一个前缀,并使用 _ 与节点名连接,防止跨文件节点名重复"
                }
              />
            }
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
            content={
              <TipElem
                content={
                  "本地JSON文件的完整路径,用于与本地服务通信时标识文件。留空则无法使用本地通信功能。例如: D:/path/to/your/pipeline.json"
                }
              />
            }
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
    </>
  );
});

export default FileConfigSection;
