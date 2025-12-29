import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Select } from "antd";
import classNames from "classnames";

import { useConfigStore } from "../../../stores/configStore";
import TipElem from "./TipElem";

const PipelineConfigSection = memo(() => {
  const nodeAttrExportStyle = useConfigStore(
    (state) => state.configs.nodeAttrExportStyle
  );
  const setConfig = useConfigStore((state) => state.setConfig);

  const globalClass = useMemo(() => classNames(style.item, style.global), []);

  return (
    <>
      <div className={style.divider}>————— Pipeline 配置 —————</div>
      {/* 节点属性导出形式 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"节点属性导出形式"}
            content={
              <TipElem
                content={
                  "对象形式：{ name: 'C', anchor: true, jump_back: true }\n前缀形式：'[Anchor][JumpBack]C'"
                }
              />
            }
          >
            <span>节点属性导出形式</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 90 }}
          value={nodeAttrExportStyle}
          onChange={(value) => setConfig("nodeAttrExportStyle", value)}
          options={[
            { value: "object", label: "对象形式" },
            { value: "prefix", label: "前缀形式" },
          ]}
        />
      </div>
    </>
  );
});

export default PipelineConfigSection;
