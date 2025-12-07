import style from "../../styles/ToolPanel.module.less";
import { memo, useMemo, useState } from "react";
import { message, Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";
import { type IconNames } from "../iconfonts";
import { useFlowStore } from "../../stores/flow";
import { useConfigStore } from "../../stores/configStore";
import { useClipboardStore } from "../../stores/clipboardStore";
import { useFileStore } from "../../stores/fileStore";
import { NodeTypeEnum } from "../flow/nodes";
import { LayoutHelper, AlignmentEnum } from "../../core/layout";
import { nodeTemplates, type NodeTemplateType } from "../../data/nodeTemplates";
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
  const clipboardNodes = useClipboardStore((state) => state.clipboardNodes);
  const debouncedSelectedNodes = useFlowStore(
    (state) => state.debouncedSelectedNodes
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const copy = useClipboardStore((state) => state.copy);
  const clipboardPaste = useClipboardStore((state) => state.paste);
  const flowPaste = useFlowStore((state) => state.paste);
  const undo = useFlowStore((state) => state.undo);
  const redo = useFlowStore((state) => state.redo);
  const getHistoryState = useFlowStore((state) => state.getHistoryState);

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
        label: "本地文件",
        iconName: "icon-bendiwenjianjia",
        iconSize: 30,
        onClick: () => {
          console.log("[ToolPanel] 点击本地文件按钮");
          setStatus("showLocalFilePanel", true);
        },
      },
      {
        label: "AI 对话历史",
        iconName: "icon-jiqiren",
        iconSize: 27,
        onClick: () => setStatus("showAIHistoryPanel", true),
      },
      {
        label: "复制 (Ctrl+C)",
        iconName: "icon-a-copyfubenfuzhi",
        iconSize: 25,
        disabled: debouncedSelectedNodes.length === 0,
        onClick: () => copy(debouncedSelectedNodes as any, []),
        onDisabledClick: () => message.error("未选中节点"),
      },
      {
        label: "粘贴 (Ctrl+V)",
        iconName: "icon-niantie1",
        iconSize: 29,
        disabled: clipboardNodes.length === 0,
        onDisabledClick: () => message.error("粘贴板中无已复制节点"),
        onClick: () => {
          const content = clipboardPaste();
          if (content) {
            flowPaste(content.nodes, content.edges);
          }
        },
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
    [clipboardNodes, debouncedSelectedNodes, historyState]
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
  }, [debouncedSelectedNodes, currentFileName, shiftNodes]);

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

const ToolPanel = {
  Add: memo(AddPanel),
  Global: memo(GlobalPanel),
  Layout: memo(LayoutPanel),
};
export default ToolPanel;
