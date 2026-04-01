import { memo, useMemo, useState } from "react";
import { message, Tooltip, Popover, Modal } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { useClipboardStore } from "../../../stores/clipboardStore";
import { useDebugStore } from "../../../stores/debugStore";
import { useMFWStore } from "../../../stores/mfwStore";
import PathSelector from "./PathSelector";
import ToolboxPanel from "./ToolboxPanel";
import style from "../../../styles/panels/ToolPanel.module.less";
import debugStyle from "../../../styles/panels/DebugPanel.module.less";

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
  const debugMode = useDebugStore((state) => state.debugMode);
  const toggleDebugMode = useDebugStore((state) => state.toggleDebugMode);
  const connectionStatus = useMFWStore((state) => state.connectionStatus);

  // 历史状态
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
          <Tooltip
            placement="bottom"
            title={
              <span>
                {debugMode ? "调试模式(已开启)" : "调试模式(已关闭)"}
                {connectionStatus !== "connected" && (
                  <span
                    className={debugStyle["debug-connection-indicator"]}
                    style={{
                      backgroundColor:
                        connectionStatus === "connecting"
                          ? "#faad14"
                          : connectionStatus === "failed"
                            ? "#ff4d4f"
                            : "#d9d9d9",
                    }}
                  />
                )}
              </span>
            }
          >
            <IconFont
              style={{ opacity: debugMode ? 1 : 0.4 }}
              className={style.icon}
              name="icon-tiaoshi"
              size={24}
              onClick={() => {
                if (connectionStatus !== "connected") {
                  message.error("请先连接本地服务与设备");
                  return;
                }
                if (!debugMode) {
                  Modal.info({
                    title: "调试模式提示",
                    content:
                      "调试功能目前仍在开发阶段，部分功能可能不完整或存在不稳定情况，敬请谅解。",
                    okText: "我知道了",
                    onOk: () => {
                      toggleDebugMode();
                      message.success("已开启调试模式");
                    },
                  });
                } else {
                  toggleDebugMode();
                  message.success("已关闭调试模式");
                }
              }}
            />
          </Tooltip>
        </li>
      </div>
    </ul>
  );
}

export default memo(GlobalPanel);
