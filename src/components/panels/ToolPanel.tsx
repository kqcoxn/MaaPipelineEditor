import style from "../../styles/ToolPanel.module.less";

import { memo } from "react";
import { Tooltip } from "antd";
import classNames from "classnames";

import IconFont from "../iconfonts";
import { type IconNames } from "../iconfonts";
import { useFlowStore } from "../../stores/flowStore";
import { NodeTypeEnum } from "../flow/nodes";

// 添加工具
const addTools = [
  {
    label: "默认节点",
    iconName: "icon-kongjiedian",
    iconSize: 36,
    nodeType: NodeTypeEnum.Pipeline,
  },
];
function AddPanel() {
  const addNode = useFlowStore((state) => state.addNode);

  const tools = addTools.map((item) => {
    return (
      <li className={style.item} key={item.label}>
        <Tooltip placement="right" title={item.label}>
          <IconFont
            className={style.icon}
            name={item.iconName as IconNames}
            size={item.iconSize ?? 36}
            onClick={() =>
              addNode({ type: item.nodeType ?? NodeTypeEnum.Pipeline })
            }
          />
        </Tooltip>
      </li>
    );
  });

  // 渲染
  return (
    <ul className={classNames(style.panel, style["add-panel"])}>{tools}</ul>
  );
}

const ToolPanel = {
  AddPanel: memo(AddPanel),
};
export default ToolPanel;
