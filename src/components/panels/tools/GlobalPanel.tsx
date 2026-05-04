import { memo, useMemo, useState } from "react";
import { message, Tooltip, Popover } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { useClipboardStore } from "../../../stores/clipboardStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { useWikiStore } from "../../../stores/wikiStore";
import { isWikiModuleVisible } from "../../../wiki/visibility";
import { WikiPonderTrigger } from "../../../features/wiki/components/WikiPonderTrigger";
import type { WikiTarget } from "../../../wiki/types";
import PathSelector from "./PathSelector";
import ToolboxPanel from "./ToolboxPanel";
import style from "../../../styles/panels/ToolPanel.module.less";

/** 全局工具 */
type GlobalToolType = {
  label: string;
  iconName: string;
  iconSize?: number;
  disabled?: boolean;
  dimmed?: boolean;
  onClick: () => void;
  onDisabledClick?: () => void;
  wiki?: {
    target: WikiTarget;
    title: string;
    description: string;
  };
};

function GlobalPanel() {
  // store
  const clipboardNodes = useClipboardStore((state) => state.clipboardNodes);
  const debouncedSelectedNodes = useFlowStore(
    (state) => state.debouncedSelectedNodes,
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const setConfig = useConfigStore((state) => state.setConfig);
  const copy = useClipboardStore((state) => state.copy);
  const clipboardPaste = useClipboardStore((state) => state.paste);
  const flowPaste = useFlowStore((state) => state.paste);
  const undo = useFlowStore((state) => state.undo);
  const redo = useFlowStore((state) => state.redo);
  const getHistoryState = useFlowStore((state) => state.getHistoryState);
  const pathMode = useFlowStore((state) => state.pathMode);
  const openDebugModal = useDebugSessionStore((state) => state.openModal);
  const openWiki = useWikiStore((state) => state.openWiki);

  // 历史状态
  const [, forceUpdate] = useState({});
  const historyState = getHistoryState();

  // 列表
  const globalTools = useMemo<GlobalToolType[]>(
    () => [
      {
        label: "系统配置",
        iconName: "icon-a-080_shezhi",
        iconSize: 39,
        onClick: () => setStatus("showConfigPanel", true),
      },
      {
        label: "文件配置",
        iconName: "icon-wenjianpeizhi",
        iconSize: 24,
        onClick: () => setStatus("showFileConfigPanel", true),
      },
      {
        label: "AI 对话历史",
        iconName: "icon-jiqiren",
        iconSize: 27,
        onClick: () => setStatus("showAIHistoryPanel", true),
        wiki: {
          target: { entryId: "ai", moduleId: "assist" },
          title: "AI 辅助",
          description: "先区分节点预测、流程探索和 AI 对话历史分别解决什么问题。",
        },
      },
    ],
    [setStatus],
  );

  // 编辑工具
  const editingTools = useMemo<GlobalToolType[]>(
    () => [
      {
        label:
          focusOpacity === 1 ? "聚焦透明度（已关闭）" : "聚焦透明度（已开启）",
        iconName: "icon-toumingdu",
        iconSize: 27,
        dimmed: focusOpacity === 1,
        onClick: () => {
          if (focusOpacity === 1) {
            setConfig("focusOpacity", 0.3);
            message.success("聚焦透明度已开启");
          } else {
            setConfig("focusOpacity", 1);
            message.success("聚焦透明度已关闭");
          }
        },
      },
      {
        label: "复制 (Ctrl+C)",
        iconName: "icon-a-copyfubenfuzhi",
        iconSize: 25,
        disabled: debouncedSelectedNodes.length === 0,
        onClick: () => copy(debouncedSelectedNodes, []),
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
    [
      clipboardNodes,
      debouncedSelectedNodes,
      historyState,
      focusOpacity,
      setConfig,
      copy,
      clipboardPaste,
      flowPaste,
      undo,
      redo,
    ],
  );

  // 生成
  const renderTools = (toolItems: GlobalToolType[]) =>
    toolItems.map((item, index) => {
      return (
        <div key={item.label} className={style.group}>
          <li className={style.item}>
            <Tooltip placement="bottom" title={item.label}>
              <IconFont
                style={{ opacity: item.disabled ? 0.2 : item.dimmed ? 0.4 : 1 }}
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
          {item.wiki && (
            <WikiPonderTrigger
              target={item.wiki.target}
              title={item.wiki.title}
              description={item.wiki.description}
              placement="bottom"
            />
          )}
          {index < toolItems.length - 1 && (
            <div className={style.devider}>
              <div></div>
            </div>
          )}
        </div>
      );
    });

  // 渲染
  const globalPanelClass = useMemo(
    () => classNames(style.panel, style["h-panel"], style["global-panel"]),
    [],
  );
  const editPanelClass = useMemo(
    () => classNames(style.panel, style["h-panel"], style["edit-panel"]),
    [],
  );

  return (
    <>
      <ul className={globalPanelClass}>
        {renderTools(globalTools)}
        {/* 路径模式按钮 */}
        <div className={style.group}>
          <div className={style.devider}>
            <div></div>
          </div>
          <li className={style.item}>
            <Popover
              placement="bottom"
              title="节点路径"
              content={<PathSelector />}
              trigger="click"
            >
              <Tooltip
                placement="bottom"
                title={pathMode ? "节点路径（已开启）" : "节点路径"}
              >
                <IconFont
                  style={{ opacity: pathMode ? 1 : 0.4 }}
                  className={style.icon}
                  name="icon-lianjie"
                  size={24}
                />
              </Tooltip>
            </Popover>
          </li>
        </div>
        {/* 工具箱按钮 */}
        <div className={style.group}>
          <div className={style.devider}>
            <div></div>
          </div>
          <li className={style.item}>
            <Popover
              placement="bottom"
              title="工具箱"
              content={<ToolboxPanel />}
              trigger="click"
            >
              <Tooltip placement="bottom" title="工具箱">
                <IconFont
                  className={style.icon}
                  name="icon-gongjuxiang"
                  size={24}
                />
              </Tooltip>
            </Popover>
          </li>
        </div>
        {/* 调试按钮 */}
        <div className={style.group}>
          <div className={style.devider}>
            <div></div>
          </div>
          <li className={style.item}>
            <Tooltip placement="bottom" title="调试">
              <IconFont
                className={style.icon}
                name="icon-tiaoshi"
                size={24}
                onClick={() => openDebugModal()}
              />
            </Tooltip>
          </li>
        </div>
        {isWikiModuleVisible && (
          <div className={style.group}>
            <div className={style.devider}>
              <div></div>
            </div>
            <li className={style.item}>
              <Tooltip placement="bottom" title="MPE Wiki / 俺寻思">
                <IconFont
                  className={style.icon}
                  name="icon-icon_wendangziliaopeizhi"
                  size={24}
                  onClick={() => openWiki()}
                />
              </Tooltip>
            </li>
          </div>
        )}
      </ul>
      <ul className={editPanelClass}>{renderTools(editingTools)}</ul>
    </>
  );
}

export default memo(GlobalPanel);
