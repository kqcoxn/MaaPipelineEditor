import { memo, useMemo } from "react";
import { Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { NodeTypeEnum } from "../../flow/nodes";
import {
  nodeTemplates,
  type NodeTemplateType,
} from "../../../data/nodeTemplates";
import style from "../../../styles/ToolPanel.module.less";

/**添加工具 */
function AddPanel() {
  const addNode = useFlowStore((state) => state.addNode);

  const addTools = useMemo<NodeTemplateType[]>(() => nodeTemplates, []);

  // 渲染
  const tools = addTools.map((item, index) => {
    return (
      <div key={item.label}>
        <li className={style.item}>
          <Tooltip placement="right" title={item.label}>
            <IconFont
              className={style.icon}
              name={item.iconName as IconNames}
              size={item.iconSize ?? 29}
              onClick={() =>
                addNode({
                  type: item.nodeType ?? NodeTypeEnum.Pipeline,
                  data: item.data?.(),
                  select: true,
                  focus: true,
                  link: true,
                })
              }
            />
          </Tooltip>
        </li>
        {index < addTools.length - 1 ? (
          <div className={style.devider}>
            <div></div>
          </div>
        ) : null}
      </div>
    );
  });
  const panelClass = useMemo(
    () => classNames(style.panel, style["add-panel"]),
    []
  );
  return <ul className={panelClass}>{tools}</ul>;
}

export default memo(AddPanel);
