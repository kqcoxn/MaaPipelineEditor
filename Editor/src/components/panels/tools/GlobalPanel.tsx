import {
  memo,
  lazy,
  Suspense,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Badge, message, Tooltip, Popover, Modal } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { useClipboardStore } from "../../../stores/clipboardStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { DebugFlowScopeIntro } from "../../../features/debug/components/DebugFlowScopeIntro";
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
const DEBUG_INTRO_CONFIRMED_KEY = "mpe_debug_intro_confirmed_v1";

function hasConfirmedDebugIntro(): boolean {
  try {
    return localStorage.getItem(DEBUG_INTRO_CONFIRMED_KEY) === "true";
  } catch {
    return false;
  }
}

function confirmDebugIntro(): void {
  try {
    localStorage.setItem(DEBUG_INTRO_CONFIRMED_KEY, "true");
  } catch {
    // ignore
  }
}

function GlobalPanel() {
  const { t } = useTranslation();

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
  const handleOpenDebugModal = () => {
    if (hasConfirmedDebugIntro()) {
      openDebugModal();
      return;
    }

    Modal.info({
      title: t(
        "ui.panels.tools.global.debugIntroTitle",
        "关于 MPE FlowScope (调试模块)",
      ),
      content: <DebugFlowScopeIntro />,
      okText: t("ui.panels.tools.global.debugIntroOk", "我知道了"),
      onOk: () => {
        confirmDebugIntro();
        openDebugModal();
      },
    });
  };
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
        label: t("ui.panels.tools.global.systemConfig", "系统配置"),
        iconName: "icon-a-080_shezhi",
        iconSize: 39,
        onClick: () => setStatus("showConfigPanel", true),
      },
      {
        label: t("ui.panels.tools.global.fileConfig", "文件配置"),
        iconName: "icon-wenjianpeizhi",
        iconSize: 24,
        onClick: () => setStatus("showFileConfigPanel", true),
      },
      {
        label: t("ui.panels.tools.global.aiHistory", "AI 对话历史"),
        iconName: "icon-jiqiren",
        iconSize: 27,
        onClick: () => setStatus("showAIHistoryPanel", true),
      },
    ],
    [setStatus, t],
  );

  // 编辑工具
  const editingTools = useMemo<GlobalToolType[]>(
    () => [
      {
        label:
          focusOpacity === 1
            ? t("ui.panels.tools.global.focusOpacityOff", "聚焦透明度（已关闭）")
            : t("ui.panels.tools.global.focusOpacityOn", "聚焦透明度（已开启）"),
        iconName: "icon-toumingdu",
        iconSize: 27,
        dimmed: focusOpacity === 1,
        onClick: () => {
          if (focusOpacity === 1) {
            setConfig("focusOpacity", 0.3);
            message.success(
              t(
                "ui.panels.tools.global.focusOpacityEnabled",
                "聚焦透明度已开启",
              ),
            );
          } else {
            setConfig("focusOpacity", 1);
            message.success(
              t(
                "ui.panels.tools.global.focusOpacityDisabled",
                "聚焦透明度已关闭",
              ),
            );
          }
        },
      },
      {
        label: t("ui.panels.tools.global.copy", "复制 (Ctrl+C)"),
        iconName: "icon-a-copyfubenfuzhi",
        iconSize: 25,
        disabled: debouncedSelectedNodes.length === 0,
        onClick: () => copy(debouncedSelectedNodes, []),
        onDisabledClick: () =>
          message.error(
            t("ui.panels.tools.global.noNodeSelected", "未选中节点"),
          ),
      },
      {
        label: t("ui.panels.tools.global.paste", "粘贴 (Ctrl+V)"),
        iconName: "icon-niantie1",
        iconSize: 29,
        disabled: clipboardNodes.length === 0,
        onDisabledClick: () =>
          message.error(
            t("ui.panels.tools.global.clipboardEmpty", "粘贴板中无已复制节点"),
          ),
        onClick: () => {
          const content = clipboardPaste();
          if (content) {
            flowPaste(content.nodes, content.edges);
          }
        },
      },
      {
        label: t("ui.panels.tools.global.undo", "撤销 (Ctrl+Z)"),
        iconName: "icon-fanhui",
        iconSize: 22,
        disabled: !historyState.canUndo,
        onDisabledClick: () =>
          message.warning(
            t("ui.panels.tools.global.nothingLeft", "真的没有了😭"),
          ),
        onClick: () => {
          if (undo()) {
            message.success(
              t("ui.panels.tools.global.undoSuccess", "撤销成功"),
            );
            forceUpdate({});
          }
        },
      },
      {
        label: t("ui.panels.tools.global.redo", "重做 (Ctrl+Y)"),
        iconName: "icon-qianjin",
        iconSize: 22,
        disabled: !historyState.canRedo,
        onDisabledClick: () =>
          message.warning(
            t("ui.panels.tools.global.nothingLeft", "真的没有了😭"),
          ),
        onClick: () => {
          if (redo()) {
            message.success(
              t("ui.panels.tools.global.redoSuccess", "重做成功"),
            );
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
      t,
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
              title={t("ui.panels.tools.global.nodePath", "节点路径")}
              content={<PathSelector />}
              trigger="click"
            >
              <Tooltip
                placement="bottom"
                title={
                  pathMode
                    ? t(
                        "ui.panels.tools.global.nodePathEnabled",
                        "节点路径（已开启）",
                      )
                    : t("ui.panels.tools.global.nodePath", "节点路径")
                }
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
                  {t("ui.panels.tools.global.toolbox", "工具箱")}
                  <span style={{ marginTop: 2 }}>
                    <WikiAnchor
                      path={t(
                        "ui.panels.tools.global.wiki.path",
                        "20.本地服务/20.字段快捷工具.html",
                      )}
                      title={t(
                        "ui.panels.tools.global.fieldToolsWikiTitle",
                        "字段快捷工具",
                      )}
                      description={t(
                        "ui.panels.tools.global.fieldToolsWikiDesc",
                        "ROI选区、OCR、取色等快捷操作",
                      )}
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
              <Tooltip
                placement="bottom"
                title={t("ui.panels.tools.global.toolbox", "工具箱")}
              >
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
            <Tooltip
              placement="bottom"
              title={t("ui.panels.tools.global.debug", "调试")}
            >
              <IconFont
                className={style.icon}
                name="icon-tiaoshi"
                size={24}
                onClick={handleOpenDebugModal}
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
            <Tooltip
              placement="bottom"
              title={t("ui.panels.tools.global.docs", "文档站")}
            >
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
