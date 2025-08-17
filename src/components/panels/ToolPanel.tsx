import style from "../../styles/ToolPanel.module.less";

import { memo } from "react";
import { Tooltip } from "antd";
import classNames from "classnames";

import IconFont from "../iconfonts";
import { type IconNames } from "../iconfonts";
import { useFlowStore } from "../../stores/flowStore";
import { NodeTypeEnum } from "../flow/nodes";

// 添加工具
interface AddToolType {
  label: string;
  iconName: string;
  iconSize?: number;
  nodeType?: NodeTypeEnum;
  data?: any;
}
const addTools: AddToolType[] = [
  {
    label: "空节点",
    iconName: "icon-kongjiedian",
    iconSize: 32,
  },
  {
    label: "文字识别",
    iconName: "icon-ocr",
    data: () => ({
      recognition: {
        type: "OCR",
        param: { expected: [""] },
      },
      action: {
        type: "Click",
        param: {},
      },
    }),
  },
  {
    label: "图像识别",
    iconName: "icon-tuxiang",
    data: () => ({
      recognition: {
        type: "TemplateMatch",
        param: { template: [""] },
      },
      action: {
        type: "Click",
        param: {},
      },
    }),
  },
  {
    label: "直接点击",
    iconName: "icon-dianji",
    data: () => ({
      action: {
        type: "Click",
        param: { target: [0, 0, 0, 0] },
      },
    }),
  },
  {
    label: "Custom",
    iconName: "icon-daima",
    iconSize: 27,
    data: () => ({
      action: {
        type: "Custom",
        param: { custom_action: "", custom_action_param: "" },
      },
    }),
  },
  {
    label: "外部节点",
    iconName: "icon-xiaofangtongdao",
    iconSize: 24,
    nodeType: NodeTypeEnum.External,
    data: () => ({
      label: "外部节点",
    }),
  },
];
function AddPanel() {
  const addNode = useFlowStore((state) => state.addNode);

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
                  data: item.data ? item.data() : null,
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

  // 渲染
  return (
    <ul className={classNames(style.panel, style["add-panel"])}>{tools}</ul>
  );
}

const ToolPanel = {
  AddPanel: memo(AddPanel),
};
export default ToolPanel;
