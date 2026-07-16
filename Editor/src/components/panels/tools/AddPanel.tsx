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
import style from "../../../styles/panels/ToolPanel.module.less";

/** 基准画布高度1 */
const BASE_HEIGHT_1 = 720;
/** 基准显示模板数量1 */
const BASE_COUNT_1 = 7;
/** 基准画布高度2 */
const BASE_HEIGHT_2 = 840;
/** 基准显示模板数量2 */
const BASE_COUNT_2 = 10;
/** 最少显示模板数量 */
const MIN_COUNT = 5;
/** 基准占位高度 */
const TOP_TOOLBAR_RESERVED_HEIGHT = 70;

/** 每个模板对应的高度增量（基于两个基准点计算） */
const HEIGHT_PER_ITEM =
  (BASE_HEIGHT_2 - BASE_HEIGHT_1) / (BASE_COUNT_2 - BASE_COUNT_1); // = 40px

/**
 * 根据画布高度计算显示的模板数量
 * 基准：720px 时显示 7 个，840px 时显示 10 个
 * 每 40px 增减 1 个模板，最少显示 5 个
 */
function calcTemplateCount(canvasHeight: number): number {
  if (canvasHeight <= 0) return BASE_COUNT_1;
  // 从 720px 为基准计算偏移量
  const count =
    BASE_COUNT_1 + Math.round((canvasHeight - BASE_HEIGHT_1) / HEIGHT_PER_ITEM);
  // 限制范围：最少5个，最多不超过模板总数
  return Math.max(MIN_COUNT, Math.min(nodeTemplates.length, count));
}

/**添加工具 */
function AddPanel() {
  const addNode = useFlowStore((state) => state.addNode);
  const canvasHeight = useFlowStore((state) => state.size.height);

  // 根据画布高度动态计算显示的模板数量
  const addTools = useMemo<NodeTemplateType[]>(
    () => {
      const availableCanvasHeight = canvasHeight - TOP_TOOLBAR_RESERVED_HEIGHT;
      return nodeTemplates.slice(0, calcTemplateCount(availableCanvasHeight));
    },
    [canvasHeight],
  );

  // 渲染节点项
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
    [],
  );

  return (
    <ul className={panelClass}>
      {tools}
      {/* 底部提示项 */}
      <div className={style.hintDivider}>
        <div></div>
      </div>
      <Tooltip placement="right" title="右键画布以显示更多模板">
        <li className={style.hintItem}>
          <IconFont className={style.hintIcon} name="icon-gengduo" size={20} />
        </li>
      </Tooltip>
    </ul>
  );
}

export default memo(AddPanel);
