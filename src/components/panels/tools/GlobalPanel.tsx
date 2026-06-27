import {
  memo,
  lazy,
  Suspense,
  useMemo,
  useState,
} from "react";
import { Badge, message, Tooltip, Popover } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { useClipboardStore } from "../../../stores/clipboardStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import PathSelector from "./PathSelector";
import { WikiAnchor } from "../../wiki/WikiAnchor";
import style from "../../../styles/panels/ToolPanel.module.less";

const ToolboxPanel = lazy(() => import("./ToolboxPanel"));

/** 全局工具 */
type GlobalToolType = {
  label: string;
  iconName: string;
  iconSize?: number;
  disabled?: boolean;
  dimmed?: boolean;
  onClick: () => void;
  onDisabledClick?: () => void;
};

const DOCS_BASE_URL = "https://mpe.codax.site/docs";

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
  const runBadgeStatus = useDebugSessionStore((state) => state.runBadgeStatus);
  const runBadgeAcknowledged = useDebugSessionStore(
    (state) => state.runBadgeAcknowledged,
  );

  const showRunBadge = !runBadgeAcknowledged && runBadgeStatus !== "idle";
  const badgeStatusMap: Record<
    string,
    "success" | "processing" | "error" | "default"
  > = {
    running: "processing",
    completed: "success",
    failed: "error",
    stopped: "default",
  };

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
              title={
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  工具箱
                  <span style={{ marginTop: 2 }}>
                    <WikiAnchor
                      path="20.本地服务/20.字段快捷工具.html"
                      title="字段快捷工具"
                      description="ROI选区、OCR、取色等快捷操作"
                    />
                  </span>
                </span>
              }
              content={
                <Suspense fallback={null}>
                  <ToolboxPanel />
                </Suspense>
              }
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
            {showRunBadge && (
              <Badge
                dot
                status={badgeStatusMap[runBadgeStatus]}
                style={{ position: "absolute", top: 6, right: 6 }}
              />
            )}
          </li>
        </div>
        <div className={style.group}>
          <div className={style.devider}>
            <div></div>
          </div>
          <li className={style.item}>
            <Tooltip placement="bottom" title="文档站">
              <IconFont
                className={style.icon}
                name="icon-icon_wendangziliaopeizhi"
                size={24}
                onClick={() => window.open(DOCS_BASE_URL, "_blank")}
              />
            </Tooltip>
          </li>
        </div>
      </ul>
      <ul className={editPanelClass}>{renderTools(editingTools)}</ul>
    </>
  );
}

export default memo(GlobalPanel);
