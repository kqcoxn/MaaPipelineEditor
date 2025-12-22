import { memo, useMemo } from "react";
import { message, Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useFileStore } from "../../../stores/fileStore";
import { LayoutHelper, AlignmentEnum } from "../../../core/layout";
import { saveNodesToImage } from "../../../utils/snapper";
import style from "../../../styles/ToolPanel.module.less";

/**布局工具 */
interface LayoutToolType {
  label: string;
  iconName: string;
  iconSize?: number;
  iconColor?: string;
  disabled?: boolean;
  onClick: () => void;
  onDisabledClick?: () => void;
}

function LayoutPanel() {
  const debouncedSelectedNodes = useFlowStore(
    (state) => state.debouncedSelectedNodes
  );
  const allNodes = useFlowStore((state) => state.nodes);
  const currentFileName = useFileStore((state) => state.currentFile.fileName);
  const shiftNodes = useFlowStore((state) => state.shiftNodes);
  const resetEdgeControls = useFlowStore((state) => state.resetEdgeControls);

  // 间距调整
  const createShiftTool = (
    label: string,
    iconName: string,
    direction: "horizontal" | "vertical",
    delta: number
  ): LayoutToolType => ({
    label,
    iconName,
    iconSize: 25,
    iconColor: "#487aaa",
    disabled:
      debouncedSelectedNodes.length >= 2 ? false : allNodes.length === 0,
    onClick: () => {
      const targetIds =
        debouncedSelectedNodes.length >= 2
          ? debouncedSelectedNodes.map((n) => n.id)
          : undefined;
      shiftNodes(direction, delta, targetIds);
    },
    onDisabledClick: () => message.error("没有可调整的节点"),
  });

  const layoutTools = useMemo<LayoutToolType[]>(() => {
    return [
      {
        label: "居中对齐",
        iconName: "icon-jurassic_horizalign-center",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length < 2,
        onClick: () =>
          LayoutHelper.align(
            AlignmentEnum.Center,
            debouncedSelectedNodes as any
          ),
        onDisabledClick: () =>
          message.error("请选择两个以上的节点进行对齐操作"),
      },
      {
        label: "顶部对齐",
        iconName: "icon-jurassic_verticalalign-top",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length < 2,
        onClick: () =>
          LayoutHelper.align(AlignmentEnum.Top, debouncedSelectedNodes as any),
        onDisabledClick: () =>
          message.error("请选择两个以上的节点进行对齐操作"),
      },
      {
        label: "底部对齐",
        iconName: "icon-jurassic_verticalalign-bottom",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length < 2,
        onClick: () =>
          LayoutHelper.align(
            AlignmentEnum.Bottom,
            debouncedSelectedNodes as any
          ),
        onDisabledClick: () =>
          message.error("请选择两个以上的节点进行对齐操作"),
      },
      createShiftTool("缩减水平间距", "icon-shuipingsuoxiao", "horizontal", -5),
      createShiftTool("增加水平间距", "icon-shuipingfangda", "horizontal", 5),
      createShiftTool("缩减垂直间距", "icon-chuizhisuoxiao", "vertical", -5),
      createShiftTool("增加垂直间距", "icon-chuizhifangda", "vertical", 5),
      {
        label: "还原连接线路径",
        iconName: "icon-connecting_line",
        iconSize: 24,
        onClick: () => {
          resetEdgeControls();
          message.success("连接线路径已还原");
        },
      },
      {
        label: "自动布局",
        iconName: "icon-liuchengtu",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length > 0 || allNodes.length === 0,
        onClick: () => LayoutHelper.auto(),
        onDisabledClick: () => message.error("自动布局仅支持全局操作"),
      },
      {
        label: "将布局保存为图片",
        iconName: "icon-guangquan",
        iconSize: 24,
        disabled: allNodes.length === 0,
        onClick: () => {
          saveNodesToImage(
            debouncedSelectedNodes as any,
            allNodes as any,
            currentFileName
          );
        },
        onDisabledClick: () => message.error("没有可保存的节点"),
      },
    ];
  }, [debouncedSelectedNodes, currentFileName, shiftNodes, resetEdgeControls]);

  // 生成
  const tools = layoutTools.map((item, index) => {
    return (
      <div key={item.label} className={style.group}>
        <li className={style.item}>
          <Tooltip placement="top" title={item.label}>
            <IconFont
              style={{ opacity: item.disabled ? 0.2 : 1 }}
              className={style.icon}
              name={item.iconName as IconNames}
              size={item.iconSize ?? 24}
              {...(item.iconColor ? { color: item.iconColor } : {})}
              onClick={() => {
                if (item.disabled) {
                  item.onDisabledClick?.();
                  return;
                }
                item.onClick?.();
              }}
            />
          </Tooltip>
        </li>
        {index < layoutTools.length - 1 && (
          <div className={style.devider}>
            <div></div>
          </div>
        )}
      </div>
    );
  });

  // 渲染
  const panelClass = useMemo(
    () => classNames(style.panel, style["h-panel"], style["layout-panel"]),
    []
  );
  return <ul className={panelClass}>{tools}</ul>;
}

export default memo(LayoutPanel);
