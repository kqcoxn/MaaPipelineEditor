import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { message, Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { type IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import { useFileStore } from "../../../stores/fileStore";
import { LayoutHelper, AlignmentEnum } from "../../../core/layout";
import { rerouteEdgesToNearestReplica } from "../../../core/parser/edgeRerouter";
import { saveNodesToImage } from "../../../utils/ui/snapper";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
import { sendToParent } from "../../../utils/embedBridge";
import style from "../../../styles/panels/ToolPanel.module.less";

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
  const { t } = useTranslation();
  const debouncedSelectedNodes = useFlowStore(
    (state) => state.debouncedSelectedNodes,
  );
  const nodeCount = useFlowStore((state) => state.nodes.length);
  const currentFileName = useFileStore((state) => state.currentFile.fileName);
  const shiftNodes = useFlowStore((state) => state.shiftNodes);
  const resetEdgeControls = useFlowStore((state) => state.resetEdgeControls);

  // 嵌入模式权限控制
  const { isEmbed, isCapAllowed } = useEmbedMode();
  const allowAutoLayout = !isEmbed || isCapAllowed("allowAutoLayout");

  const noNodesToAdjust = () =>
    message.error(
      t("ui.panels.tools.layout.noNodesToAdjust", "没有可调整的节点"),
    );
  const selectTwoForAlign = () =>
    message.error(
      t(
        "ui.panels.tools.layout.selectTwoForAlign",
        "请选择两个以上的节点进行对齐操作",
      ),
    );
  const autoLayoutDeniedMessage = t(
    "ui.panels.tools.layout.autoLayoutDenied",
    "当前环境禁止自动布局",
  );

  // 间距调整
  const createShiftTool = (
    label: string,
    iconName: string,
    direction: "horizontal" | "vertical",
    delta: number,
  ): LayoutToolType => ({
    label,
    iconName,
    iconSize: 25,
    iconColor: "#487aaa",
    disabled:
      debouncedSelectedNodes.length >= 2 ? false : nodeCount === 0,
    onClick: () => {
      const targetIds =
        debouncedSelectedNodes.length >= 2
          ? debouncedSelectedNodes.map((n) => n.id)
          : undefined;
      shiftNodes(direction, delta, targetIds);
    },
    onDisabledClick: noNodesToAdjust,
  });

  const layoutTools = useMemo<LayoutToolType[]>(() => {
    return [
      {
        label: t("ui.panels.tools.layout.alignCenter", "居中对齐"),
        iconName: "icon-jurassic_horizalign-center",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length < 2,
        onClick: () =>
          LayoutHelper.align(
            AlignmentEnum.Center,
            debouncedSelectedNodes as any,
          ),
        onDisabledClick: selectTwoForAlign,
      },
      {
        label: t("ui.panels.tools.layout.alignTop", "顶部对齐"),
        iconName: "icon-jurassic_verticalalign-top",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length < 2,
        onClick: () =>
          LayoutHelper.align(AlignmentEnum.Top, debouncedSelectedNodes as any),
        onDisabledClick: selectTwoForAlign,
      },
      {
        label: t("ui.panels.tools.layout.alignBottom", "底部对齐"),
        iconName: "icon-jurassic_verticalalign-bottom",
        iconSize: 30,
        disabled: debouncedSelectedNodes.length < 2,
        onClick: () =>
          LayoutHelper.align(
            AlignmentEnum.Bottom,
            debouncedSelectedNodes as any,
          ),
        onDisabledClick: selectTwoForAlign,
      },
      createShiftTool(
        t("ui.panels.tools.layout.shrinkHorizontal", "缩减水平间距"),
        "icon-shuipingsuoxiao",
        "horizontal",
        -5,
      ),
      createShiftTool(
        t("ui.panels.tools.layout.expandHorizontal", "增加水平间距"),
        "icon-shuipingfangda",
        "horizontal",
        5,
      ),
      createShiftTool(
        t("ui.panels.tools.layout.shrinkVertical", "缩减垂直间距"),
        "icon-chuizhisuoxiao",
        "vertical",
        -5,
      ),
      createShiftTool(
        t("ui.panels.tools.layout.expandVertical", "增加垂直间距"),
        "icon-chuizhifangda",
        "vertical",
        5,
      ),
      {
        label: t("ui.panels.tools.layout.resetEdgePaths", "还原连接线路径"),
        iconName: "icon-connecting_line",
        iconSize: 24,
        onClick: () => {
          const { nodes, edges, setEdges } = useFlowStore.getState();
          const rerouted = rerouteEdgesToNearestReplica(nodes, edges);
          setEdges(rerouted);
          resetEdgeControls();
          message.success(
            t("ui.panels.tools.layout.edgesReset", "连接线路径已还原"),
          );
        },
      },
      {
        label:
          debouncedSelectedNodes.length >= 2
            ? t("ui.panels.tools.layout.partialAutoLayout", "局部自动布局")
            : t("ui.panels.tools.layout.autoLayout", "自动布局"),
        iconName: "icon-liuchengtu",
        iconSize: 30,
        disabled:
          !allowAutoLayout ||
          debouncedSelectedNodes.length === 1 ||
          nodeCount === 0,
        onClick: () => {
          if (!allowAutoLayout) {
            sendToParent("mpe:error", {
              code: "capability_denied",
              message: autoLayoutDeniedMessage,
            });
            return;
          }
          if (debouncedSelectedNodes.length >= 2) {
            LayoutHelper.autoPartial(debouncedSelectedNodes as any);
          } else {
            LayoutHelper.auto();
          }
        },
        onDisabledClick: () => {
          if (!allowAutoLayout) {
            sendToParent("mpe:error", {
              code: "capability_denied",
              message: autoLayoutDeniedMessage,
            });
          } else {
            message.error(
              t(
                "ui.panels.tools.layout.selectTwoForPartial",
                "请选择两个以上节点进行局部排版",
              ),
            );
          }
        },
      },
      {
        label: t("ui.panels.tools.layout.saveAsImage", "将布局保存为图片"),
        iconName: "icon-guangquan",
        iconSize: 24,
        disabled: nodeCount === 0,
        onClick: () => {
          saveNodesToImage(
            debouncedSelectedNodes as any,
            useFlowStore.getState().nodes as any,
            currentFileName,
          );
        },
        onDisabledClick: () =>
          message.error(
            t("ui.panels.tools.layout.noNodesToSave", "没有可保存的节点"),
          ),
      },
    ];
  }, [
    allowAutoLayout,
    autoLayoutDeniedMessage,
    currentFileName,
    debouncedSelectedNodes,
    nodeCount,
    resetEdgeControls,
    shiftNodes,
    t,
  ]);

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
    [],
  );
  return <ul className={panelClass}>{tools}</ul>;
}

export default memo(LayoutPanel);
