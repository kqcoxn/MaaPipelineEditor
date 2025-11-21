import style from "../../styles/ToolPanel.module.less";

import { memo, useMemo, useState } from "react";
import { message, Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";
import { type IconNames } from "../iconfonts";

import {
  useFlowStore,
  undo,
  redo,
  getHistoryState,
} from "../../stores/flowStore";
import { useConfigStore } from "../../stores/configStore";
import { useFileStore } from "../../stores/fileStore";
import { NodeTypeEnum } from "../flow/nodes";
import { LayoutHelper, AlignmentEnum } from "../../core/layout";
import { nodeTemplates, type NodeTemplateType } from "../../core/nodeTemplates";
import { saveNodesToImage } from "../../utils/snapper";

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

/**全局工具 */
type GlobalToolType = {
  label: string;
  iconName: string;
  iconSize?: number;
  disabled?: boolean;
  onClick: () => void;
  onDisabledClick?: () => void;
};
function GlobalPanel() {
  // store
  const clipBoard = useConfigStore((state) => state.clipBoard);
  const selectedNodes = useFlowStore((state) => state.bfSelectedNodes);
  const setStatus = useConfigStore((state) => state.setStatus);
  const setClipBoard = useConfigStore((state) => state.setClipBoard);
  const applyClipBoard = useConfigStore((state) => state.applyClipBoard);

  // 历史状态 - 使用状态强制更新
  const [, forceUpdate] = useState({});
  const historyState = getHistoryState();

  // 列表
  const globalTools = useMemo<GlobalToolType[]>(
    () => [
      {
        label: "设置",
        iconName: "icon-a-080_shezhi",
        iconSize: 39,
        onClick: () => setStatus("showConfigPanel", true),
      },
      {
        label: "复制 (Ctrl+C)",
        iconName: "icon-a-copyfubenfuzhi",
        iconSize: 25,
        disabled: selectedNodes.length === 0,
        onClick: () => setClipBoard(),
        onDisabledClick: () => message.error("未选中节点"),
      },
      {
        label: "粘贴 (Ctrl+V)",
        iconName: "icon-niantie1",
        iconSize: 29,
        disabled: clipBoard.nodes.length === 0,
        onDisabledClick: () => message.error("粘贴板中无已复制节点"),
        onClick: () => applyClipBoard(),
      },
      {
        label: "撤销 (Ctrl+Z)",
        iconName: "icon-fanhui",
        iconSize: 22,
        disabled: !historyState.canUndo,
        onDisabledClick: () => message.warning("真的没有了😭"),
        onClick: () => {
          if (undo()) {
            message.success("撤销成功");
            forceUpdate({});
          }
        },
      },
      {
        label: "重做 (Ctrl+Y)",
        iconName: "icon-qianjin",
        iconSize: 22,
        disabled: !historyState.canRedo,
        onDisabledClick: () => message.warning("真的没有了😭"),
        onClick: () => {
          if (redo()) {
            message.success("重做成功");
            forceUpdate({});
          }
        },
      },
    ],
    [clipBoard, selectedNodes, historyState]
  );

  // 生成
  const tools = globalTools.map((item, index) => {
    return (
      <div key={item.label} className={style.group}>
        <li className={style.item}>
          <Tooltip placement="bottom" title={item.label}>
            <IconFont
              style={{ opacity: item.disabled ? 0.2 : 1 }}
              className={style.icon}
              name={item.iconName as IconNames}
              size={item.iconSize ?? 24}
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
        {index < globalTools.length - 1 && (
          <div className={style.devider}>
            <div></div>
          </div>
        )}
      </div>
    );
  });

  // 渲染
  const panelClass = useMemo(
    () => classNames(style.panel, style["h-panel"], style["global-panel"]),
    []
  );
  return <ul className={panelClass}>{tools}</ul>;
}

/**布局工具 */
interface LayoutToolType {
  label: string;
  iconName: string;
  iconSize?: number;
  disabled?: boolean;
  onClick: () => void;
  onDisabledClick?: () => void;
}
function LayoutPanel() {
  const selectedNodes = useFlowStore((state) => state.bfSelectedNodes);
  const allNodes = useFlowStore((state) => state.nodes);
  const currentFileName = useFileStore((state) => state.currentFile.fileName);

  const layoutTools = useMemo<LayoutToolType[]>(() => {
    return [
      {
        label: "居中对齐",
        iconName: "icon-jurassic_horizalign-center",
        iconSize: 30,
        disabled: selectedNodes.length < 2,
        onClick: () => LayoutHelper.align(AlignmentEnum.Center, selectedNodes),
        onDisabledClick: () =>
          message.error("请选择两个以上的节点进行对齐操作"),
      },
      {
        label: "顶部对齐",
        iconName: "icon-jurassic_verticalalign-top",
        iconSize: 30,
        disabled: selectedNodes.length < 2,
        onClick: () => LayoutHelper.align(AlignmentEnum.Top, selectedNodes),
        onDisabledClick: () =>
          message.error("请选择两个以上的节点进行对齐操作"),
      },
      {
        label: "底部对齐",
        iconName: "icon-jurassic_verticalalign-bottom",
        iconSize: 30,
        disabled: selectedNodes.length < 2,
        onClick: () => LayoutHelper.align(AlignmentEnum.Bottom, selectedNodes),
        onDisabledClick: () =>
          message.error("请选择两个以上的节点进行对齐操作"),
      },
      {
        label: "自动布局",
        iconName: "icon-liuchengtu",
        iconSize: 30,
        disabled: selectedNodes.length > 0 || allNodes.length === 0,
        onClick: () => LayoutHelper.auto(),
        onDisabledClick: () => message.error("自动布局仅支持全局操作"),
      },
      {
        label: "将布局保存为图片",
        iconName: "icon-guangquan",
        iconSize: 24,
        disabled: allNodes.length === 0,
        onClick: () => {
          saveNodesToImage(selectedNodes, allNodes, currentFileName);
        },
        onDisabledClick: () => message.error("没有可保存的节点"),
      },
    ];
  }, [selectedNodes, currentFileName]);

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

const ToolPanel = {
  Add: memo(AddPanel),
  Global: memo(GlobalPanel),
  Layout: memo(LayoutPanel),
};
export default ToolPanel;
