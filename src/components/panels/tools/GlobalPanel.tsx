import { memo, useMemo, useState } from "react";
import { message, Tooltip, Popover, Modal } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { useClipboardStore } from "../../../stores/clipboardStore";
import PathSelector from "./PathSelector";
import ToolboxPanel from "./ToolboxPanel";
import style from "../../../styles/panels/ToolPanel.module.less";

/**全局工具 */
type GlobalToolType = {
  label: string;
  iconName: string;
  iconSize?: number;
  disabled?: boolean;
  dimmed?: boolean;
  onClick: () => void;
  onDisabledClick?: () => void;
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
      },
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
    [clipboardNodes, debouncedSelectedNodes, historyState, focusOpacity],
  );

  // 生成
  const tools = globalTools.map((item, index) => {
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
    [],
  );
  return (
    <ul className={panelClass}>
      {tools}
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
      {/* 调试模式按钮 */}
      <div className={style.group}>
        <div className={style.devider}>
          <div></div>
        </div>
        <li className={style.item}>
          <Tooltip placement="bottom" title="调试模式">
            <IconFont
              style={{ opacity: 0.4 }}
              className={style.icon}
              name="icon-tiaoshi"
              size={24}
              onClick={() => {
                // 临时禁用调试功能
                Modal.warning({
                  title: "调试功能正在重构",
                  content:
                    "当前调试功能正在重构中，暂时不可用。请先使用其他调试软件（如 MaaDebugger、VSCode 插件等）。",
                  footer: (
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        justifyContent: "flex-end",
                        marginTop: 12,
                      }}
                    >
                      <a
                        href="https://github.com/MaaXYZ/MaaDebugger"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button
                          style={{
                            padding: "4px 15px",
                            background: "transparent",
                            color: "rgba(0, 0, 0, 0.88)",
                            border: "1px solid #d9d9d9",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          MaaDebugger
                        </button>
                      </a>
                      <a
                        href="https://github.com/neko-para/maa-support-extension"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button
                          style={{
                            padding: "4px 15px",
                            background: "transparent",
                            color: "rgba(0, 0, 0, 0.88)",
                            border: "1px solid #d9d9d9",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          VSC 插件
                        </button>
                      </a>
                      <button
                        style={{
                          padding: "4px 15px",
                          background: "#1677ff",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                        onClick={() => Modal.destroyAll()}
                      >
                        知道了
                      </button>
                    </div>
                  ),
                });
              }}
            />
          </Tooltip>
        </li>
      </div>
    </ul>
  );
}

export default memo(GlobalPanel);
