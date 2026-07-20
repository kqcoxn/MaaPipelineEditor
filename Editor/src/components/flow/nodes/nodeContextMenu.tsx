import { message, Modal } from "antd";
import type { ReactNode } from "react";
import { FlagOutlined, PlayCircleOutlined } from "@ant-design/icons";
import type { Node } from "@xyflow/react";
import uiT from "../../../i18n/translate";
import { NodeTypeEnum, HANDLE_DIRECTION_OPTIONS } from "./constants";
import type { HandleDirection } from "./constants";
import type {
  PipelineNodeDataType,
  ExternalNodeDataType,
  AnchorNodeDataType,
  StickerNodeDataType,
  GroupNodeDataType,
  StickerColorTheme,
} from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import {
  copyNodeName,
  saveNodeAsTemplate,
  deleteNode,
  copyNodeRecoJSON,
} from "./utils/nodeOperations";
import { debugProtocolClient } from "../../../services/server";
import { useDebugModalMemoryStore } from "../../../stores/debugModalMemoryStore";
import { saveOpenedLocalFilesForDebug } from "../../../stores/fileStore";
import {
  makeDebugResourceKey,
  normalizeDebugResourcePaths,
  useDebugRunProfileStore,
} from "../../../stores/debugRunProfileStore";
import { useDebugOverrideStore } from "../../../stores/debugOverrideStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { useMFWStore } from "../../../stores/mfwStore";
import { useWSStore } from "../../../stores/wsStore";
import type {
  DebugCapabilityManifest,
  DebugRunMode,
} from "../../../features/debug/types";
import { getDebugReadiness } from "../../../features/debug/readiness";
import { applyDebugNodeTarget } from "../../../features/debug/nodeTargetActions";
import {
  DEBUG_PIPELINE_OVERRIDE_ERROR_CODE,
  parseDebugPipelineOverrideDraft,
} from "../../../features/debug/pipelineOverride";

/**菜单项类型 */
export interface NodeContextMenuItem {
  key: string;
  label: string;
  icon: ReactNode | string;
  iconSize?: number;
  onClick: (node: NodeContextMenuNode) => void;
  disabled?: boolean | ((node: NodeContextMenuNode) => boolean);
  disabledTip?: string;
  visible?: (node: NodeContextMenuNode) => boolean;
  danger?: boolean;
}

/**子菜单项类型 */
export interface NodeContextMenuSubItem {
  key: string;
  label: string;
  icon?: ReactNode | string;
  iconSize?: number;
  onClick: (node: NodeContextMenuNode) => void;
  disabled?: boolean | ((node: NodeContextMenuNode) => boolean);
  checked?: boolean | ((node: NodeContextMenuNode) => boolean);
}

/**带子菜单的菜单项类型 */
export interface NodeContextMenuWithChildren {
  key: string;
  label: string;
  icon: ReactNode | string;
  iconSize?: number;
  children: NodeContextMenuSubItem[];
  visible?: (node: NodeContextMenuNode) => boolean;
}

/**分隔线类型 */
export interface NodeContextMenuDivider {
  type: "divider";
  key: string;
}

/**菜单配置项联合类型 */
export type NodeContextMenuConfig =
  | NodeContextMenuItem
  | NodeContextMenuDivider
  | NodeContextMenuWithChildren;

/**节点类型联合 */
export type NodeContextMenuNode =
  | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
  | Node<ExternalNodeDataType, NodeTypeEnum.External>
  | Node<AnchorNodeDataType, NodeTypeEnum.Anchor>
  | Node<StickerNodeDataType, NodeTypeEnum.Sticker>
  | Node<GroupNodeDataType, NodeTypeEnum.Group>;

type NodeDataWithHandleDirection = {
  handleDirection?: HandleDirection;
};

type NodeDataWithColor = {
  color?: string;
};

type ResourcePreflightRequestResult = "sent" | "empty" | "send-failed";

const pendingResourcePreflightRuns = new Set<string>();

/**复制节点名处理器 */
function handleCopyNodeName(node: NodeContextMenuNode) {
  copyNodeName(node.data.label, node.type);
}

/**保存为模板处理器 */
function handleSaveAsTemplate(node: NodeContextMenuNode) {
  if (node.type !== NodeTypeEnum.Pipeline) {
    message.error(
      uiT(
        "ui.flow.nodeContextMenu.pipelineTemplateOnly",
        "仅支持 Pipeline 节点保存为模板",
      ),
    );
    return;
  }

  const pipelineNode = node as Node<
    PipelineNodeDataType,
    NodeTypeEnum.Pipeline
  >;
  saveNodeAsTemplate(pipelineNode.data.label, pipelineNode.data);
}

/**删除节点处理器 */
function handleDeleteNode(node: NodeContextMenuNode) {
  deleteNode(node.id);
}

/**复制 Reco JSON 处理器 */
function handleCopyRecoJSON(node: NodeContextMenuNode) {
  copyNodeRecoJSON(node.id);
}

/**设置节点端点位置处理器 */
function handleSetNodeDirection(
  node: NodeContextMenuNode,
  direction: HandleDirection,
) {
  const { nodes, setNodes, saveHistory } = useFlowStore.getState();
  const newNodes = nodes.map((n) => {
    if (n.id === node.id) {
      return {
        ...n,
        data: {
          ...n.data,
          handleDirection: direction === "left-right" ? undefined : direction,
        },
      };
    }
    return n;
  });
  setNodes(newNodes);
  saveHistory(0, {
    category: "node",
    action: "update",
    description: uiT("ui.flow.nodeContextMenu.setHandleDirectionHistory", "设置端点位置"),
    targetIds: [node.id],
  });
  message.success(
    uiT("ui.flow.nodeContextMenu.handleDirectionSet", "端点位置已设置为「{{label}}」", {
      label:
        HANDLE_DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? "",
    }),
  );
}

/**获取当前节点的端点位置 */
function getNodeDirection(node: NodeContextMenuNode): HandleDirection {
  return (
    (node.data as NodeDataWithHandleDirection).handleDirection || "left-right"
  );
}

/**解散分组处理器 */
function handleUngroupNodes(node: NodeContextMenuNode) {
  useFlowStore.getState().ungroupNodes(node.id);
}

/**更改分组颜色处理器 */
function handleSetGroupColor(node: NodeContextMenuNode, color: string) {
  useFlowStore.getState().setNodeData(node.id, "direct", "color", color);
  useFlowStore.getState().saveHistory(0, {
    category: "group",
    action: "update",
    description: uiT("ui.flow.nodeContextMenu.changeGroupColorHistory", "更改分组颜色"),
    targetIds: [node.id],
  });
}

/**更改便签颜色处理器 */
function handleSetStickerColor(
  node: NodeContextMenuNode,
  color: StickerColorTheme,
) {
  if (node.type !== NodeTypeEnum.Sticker) return;

  useFlowStore.getState().setNodeData(node.id, "sticker", "color", color);
  useFlowStore.getState().saveHistory(0, {
    category: "node",
    action: "update",
    description: uiT("ui.flow.nodeContextMenu.changeStickerColorHistory", "更改便签颜色"),
    targetIds: [node.id],
  });
}

/**复制便签内容处理器 */
function handleCopyStickerContent(node: NodeContextMenuNode) {
  if (node.type !== NodeTypeEnum.Sticker) return;

  const content = (node.data as StickerNodeDataType).content;
  if (content) {
    navigator.clipboard.writeText(content);
    message.success(
      uiT("ui.flow.nodeContextMenu.stickerContentCopied", "便签内容已复制到剪贴板"),
    );
  } else {
    message.info(uiT("ui.flow.nodeContextMenu.stickerContentEmpty", "便签内容为空"));
  }
}

/**编辑 JSON 处理器 */
function handleEditNodeJson(node: NodeContextMenuNode) {
  // 触发全局事件
  const event = new CustomEvent("mpe:edit-node-json", {
    detail: { node },
  });
  window.dispatchEvent(event);
}

function handleDebugRunMode(node: NodeContextMenuNode, mode: DebugRunMode) {
  if (node.type !== NodeTypeEnum.Pipeline) return;

  const sessionState = useDebugSessionStore.getState();
  const profileState = useDebugRunProfileStore.getState();
  const mfwState = useMFWStore.getState();

  const target = applyDebugNodeTarget(node.id, {
    focusCanvas: true,
    rememberEntryNodeId: true,
  });
  if (!target) return;
  useDebugModalMemoryStore.getState().setLastRunMode(mode);

  const capabilities = sessionState.capabilities;
  const resourceKey = makeDebugResourceKey(profileState.profile.resourcePaths);
  const resourcePreflight = sessionState.resourcePreflight;
  const resourcePreflightMatches =
    resourcePreflight.resourceKey === resourceKey;
  const readiness = getDebugReadiness({
    localBridgeConnected: useWSStore.getState().connected,
    deviceConnectionStatus: mfwState.connectionStatus,
    controllerId: mfwState.controllerId,
    resourceStatus: resourcePreflightMatches
      ? resourcePreflight.status
      : "idle",
    resourceError: resourcePreflightMatches
      ? resourcePreflight.error
      : undefined,
  });
  if (!readiness.ready) {
    const blockingIssue = readiness.issues.find(
      (issue) => issue.code !== "debug.resource.not_ready",
    );
    if (blockingIssue) {
      message.error(blockingIssue.message);
      return;
    }

    if (resourcePreflightMatches && resourcePreflight.status === "checking") {
      scheduleDebugRunAfterResourcePreflight(node, mode, resourceKey);
      message.info(
        uiT(
          "ui.flow.nodeContextMenu.autoStartAfterPreflight",
          "资源检测完成后将自动启动调试。",
        ),
      );
      return;
    }

    // status 为 error 或 idle 时均重新发起检测，
    // 避免资源修复后仍卡在旧的失败结果上。
    const requestResult = requestDebugResourcePreflight(resourceKey);
    if (requestResult === "sent") {
      scheduleDebugRunAfterResourcePreflight(node, mode, resourceKey);
      message.info(
        uiT(
          "ui.flow.nodeContextMenu.checkingResourcesAutoStart",
          "正在检测资源路径，检测完成后将自动启动调试。",
        ),
      );
    } else if (requestResult === "empty") {
      message.warning(
        uiT(
          "ui.flow.nodeContextMenu.configureResourcePathsFirst",
          "请先配置资源路径或等待 LocalBridge 扫描资源包",
        ),
      );
    }
    return;
  }
  if (!capabilities?.runModes.includes(mode)) {
    message.warning(
      uiT("ui.flow.nodeContextMenu.runModeUnsupported", "当前 LocalBridge 暂不支持调试模式: {{mode}}", {
        mode,
      }),
    );
    return;
  }
  void handleDebugRunModeWithInput(node, mode);
}

function scheduleDebugRunAfterResourcePreflight(
  node: NodeContextMenuNode,
  mode: DebugRunMode,
  resourceKey: string,
) {
  const pendingKey = `${resourceKey}\u0000${node.id}\u0000${mode}`;
  if (pendingResourcePreflightRuns.has(pendingKey)) return;
  pendingResourcePreflightRuns.add(pendingKey);

  let timeoutId: number | undefined;
  const unsubscribe = debugProtocolClient.onResourcePreflight((result) => {
    const resultResourceKey = normalizeDebugResourcePaths(
      result.resourcePaths,
      [],
    ).join("\n");
    if (resultResourceKey !== resourceKey) return;

    cleanup();
    if (result.status !== "ready") {
      const firstError = result.diagnostics?.find(
        (diagnostic) => diagnostic.severity === "error",
      );
      const errorMessage =
        firstError?.message ??
        uiT(
          "ui.flow.nodeContextMenu.resourcePreflightFailedAutoStart",
          "资源加载检测失败，无法自动启动调试。",
        );
      Modal.error({
        title: uiT(
          "ui.flow.nodeContextMenu.resourcePreflightFailedTitle",
          "资源加载检测失败",
        ),
        content: (
          <div>
            <p>{errorMessage}</p>
            <p>
              {uiT(
                "ui.flow.nodeContextMenu.resourcePreflightFailedHint",
                "您可以前往「资源体检」面板查看详细诊断信息并尝试修复。",
              )}
            </p>
          </div>
        ),
        okText: uiT(
          "ui.flow.nodeContextMenu.goToResourceHealth",
          "前往资源体检",
        ),
        onOk: () => {
          const debugSessionStore = useDebugSessionStore.getState();
          debugSessionStore.openModal("resource-health");
        },
      });
      return;
    }

    handleDebugRunMode(node, mode);
  });

  timeoutId = window.setTimeout(() => {
    cleanup();
    message.error(
      uiT(
        "ui.flow.nodeContextMenu.resourcePreflightTimeout",
        "资源路径检测超时，无法自动启动调试。",
      ),
    );
  }, 60_000);

  function cleanup() {
    pendingResourcePreflightRuns.delete(pendingKey);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    unsubscribe();
  }
}

function handleSetDebugEntry(node: NodeContextMenuNode) {
  if (node.type !== NodeTypeEnum.Pipeline) return;

  applyDebugNodeTarget(node.id, {
    focusCanvas: true,
    openPanel: "overview",
    rememberPanel: true,
    setEntry: true,
    successMessage: uiT("ui.flow.nodeContextMenu.setDebugEntrySuccess", "已设为调试入口节点"),
  });
}

function requestDebugResourcePreflight(
  resourceKey: string,
): ResourcePreflightRequestResult {
  const resourcePaths = normalizeDebugResourcePaths(
    useDebugRunProfileStore.getState().profile.resourcePaths,
  );
  if (resourcePaths.length === 0) return "empty";
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sessionState = useDebugSessionStore.getState();
  sessionState.setResourcePreflightChecking(requestId, resourceKey);
  const sent = debugProtocolClient.preflightResources({
    requestId,
    resourcePaths,
  });
  if (!sent) {
    sessionState.setResourcePreflightError(
      requestId,
      resourceKey,
      uiT(
        "ui.flow.nodeContextMenu.sendPreflightRequestFailedDetail",
        "发送资源加载检测请求失败。",
      ),
    );
    message.error(
      uiT(
        "ui.flow.nodeContextMenu.sendPreflightRequestFailed",
        "发送资源加载检测请求失败",
      ),
    );
    return "send-failed";
  }
  return "sent";
}

async function handleDebugRunModeWithInput(
  node: NodeContextMenuNode,
  mode: DebugRunMode,
  input?: { confirmAction?: boolean },
): Promise<void> {
  if (node.type !== NodeTypeEnum.Pipeline) return;

  const sessionState = useDebugSessionStore.getState();
  const profileState = useDebugRunProfileStore.getState();
  const overrideParseResult = parseDebugPipelineOverrideDraft(
    useDebugOverrideStore.getState().draft,
  );

  try {
    sessionState.clearProtocolError();
    if (overrideParseResult.error) {
      sessionState.setProtocolError({
        code: DEBUG_PIPELINE_OVERRIDE_ERROR_CODE,
        message: overrideParseResult.error,
      });
      message.error(overrideParseResult.error);
      return;
    }
    if (profileState.profile.savePolicy === "save-open-files") {
      const saveResult = await saveOpenedLocalFilesForDebug();
      if (saveResult.failedFiles.length > 0) {
        message.error(
          uiT(
            "ui.flow.nodeContextMenu.saveOpenFilesFailed",
            "调试前保存打开文件失败：{{files}}",
            { files: saveResult.failedFiles.join("、") },
          ),
        );
        return;
      }
    }
    const request = profileState.buildRunRequest(
      mode,
      node.id,
      sessionState.session?.sessionId,
      input,
      overrideParseResult.overrides,
    );
    if (!request.target) {
      message.error(
        uiT("ui.flow.nodeContextMenu.resolveRunNameFailed", "无法解析节点运行名"),
      );
      return;
    }
    profileState.setEntry(request.target);
    const sent = debugProtocolClient.startRun(request);
    if (!sent)
      message.error(
        uiT("ui.flow.nodeContextMenu.sendDebugStartFailed", "发送调试启动请求失败"),
      );
  } catch (error) {
    message.error(
      error instanceof Error
        ? error.message
        : uiT("ui.flow.nodeContextMenu.buildDebugRequestFailed", "生成调试请求失败"),
    );
  }
}

function isDebugRunModeUnavailable(
  mode: DebugRunMode,
  capabilities?: DebugCapabilityManifest,
): boolean {
  return !capabilities?.runModes.includes(mode);
}

/**删除分组（先解散子节点再删除）处理器 */
function handleDeleteGroup(node: NodeContextMenuNode) {
  // 先解散子节点
  useFlowStore.getState().ungroupNodes(node.id);
}

/**获取节点右键菜单配置 */
export function getNodeContextMenuConfig(
  node: NodeContextMenuNode,
  options: { debugCapabilities?: DebugCapabilityManifest } = {},
): NodeContextMenuConfig[] {
  // Group 节点使用专用菜单
  if (node.type === NodeTypeEnum.Group) {
    const groupColors = [
      { key: "blue", label: uiT("ui.flow.nodeContextMenu.color.blue", "蓝色") },
      { key: "green", label: uiT("ui.flow.nodeContextMenu.color.green", "绿色") },
      { key: "purple", label: uiT("ui.flow.nodeContextMenu.color.purple", "紫色") },
      { key: "orange", label: uiT("ui.flow.nodeContextMenu.color.orange", "橙色") },
      { key: "gray", label: uiT("ui.flow.nodeContextMenu.color.gray", "灰色") },
    ];
    return [
      {
        key: "group-color",
        label: uiT("ui.flow.nodeContextMenu.groupColor", "分组颜色"),
        icon: "icon-tiaoseban",
        iconSize: 16,
        children: groupColors.map((c) => ({
          key: `group-color-${c.key}`,
          label: c.label,
          onClick: (node) => handleSetGroupColor(node, c.key),
          checked: (node) => (node.data as NodeDataWithColor).color === c.key,
        })),
      },
      {
        type: "divider",
        key: "divider-group-1",
      },
      {
        key: "ungroup",
        label: uiT("ui.flow.nodeContextMenu.ungroup", "解散分组"),
        icon: "icon-quxiaoguanlian",
        iconSize: 16,
        onClick: handleUngroupNodes,
      },
      {
        key: "delete-group",
        label: uiT("ui.flow.nodeContextMenu.deleteGroup", "删除分组"),
        icon: "icon-shanchu",
        iconSize: 16,
        onClick: handleDeleteGroup,
        danger: true,
      },
    ];
  }

  const config: NodeContextMenuConfig[] = [
    {
      key: "debug-set-entry",
      label: uiT("ui.flow.nodeContextMenu.setDebugEntry", "设为入口节点"),
      icon: <FlagOutlined />,
      onClick: handleSetDebugEntry,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    {
      key: "debug-run-from-node",
      label: uiT("ui.flow.nodeContextMenu.runFromNode", "从此节点运行"),
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "run-from-node"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable(
          "run-from-node",
          options.debugCapabilities,
        ),
      disabledTip: uiT(
        "ui.flow.nodeContextMenu.runFromNodeUnavailable",
        "当前 LocalBridge 未暴露 run-from-node 能力",
      ),
    },
    {
      key: "debug-single-node-run",
      label: uiT("ui.flow.nodeContextMenu.singleNodeRun", "单节点运行"),
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "single-node-run"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable(
          "single-node-run",
          options.debugCapabilities,
        ),
      disabledTip: uiT(
        "ui.flow.nodeContextMenu.singleNodeRunUnavailable",
        "当前 LocalBridge 未暴露 single-node-run 能力",
      ),
    },
    {
      key: "debug-recognition-only",
      label: uiT("ui.flow.nodeContextMenu.recognitionOnly", "仅识别"),
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "recognition-only"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable(
          "recognition-only",
          options.debugCapabilities,
        ),
      disabledTip: uiT(
        "ui.flow.nodeContextMenu.recognitionOnlyUnavailable",
        "当前 LocalBridge 未暴露 recognition-only 能力",
      ),
    },
    {
      key: "debug-action-only",
      label: uiT("ui.flow.nodeContextMenu.actionOnly", "仅动作"),
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "action-only"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable("action-only", options.debugCapabilities),
      disabledTip: uiT(
        "ui.flow.nodeContextMenu.actionOnlyUnavailable",
        "当前 LocalBridge 未暴露 action-only 能力",
      ),
      danger: true,
    },
    {
      type: "divider",
      key: "divider-debug",
    },
    // 复制节点名
    {
      key: "copy-node-name",
      label: uiT("ui.flow.nodeContextMenu.copyNodeName", "复制节点名"),
      icon: "icon-a-copyfubenfuzhi",
      iconSize: 16,
      onClick: handleCopyNodeName,
    },
    // 编辑 JSON (所有节点)
    {
      key: "edit-json",
      label: uiT("ui.flow.nodeContextMenu.editJson", "编辑 JSON"),
      icon: "icon-JSON",
      iconSize: 16,
      onClick: handleEditNodeJson,
    },
    // 复制便签内容 (仅 Sticker 节点)
    {
      key: "copy-sticker-content",
      label: uiT("ui.flow.nodeContextMenu.copyStickerContent", "复制便签内容"),
      icon: "icon-fuzhi",
      iconSize: 16,
      onClick: handleCopyStickerContent,
      visible: (node) => node.type === NodeTypeEnum.Sticker,
    },
    // 复制 Reco JSON (仅 Pipeline 节点)
    {
      key: "copy-reco-json",
      label: uiT("ui.flow.nodeContextMenu.copyRecoJson", "复制 Reco JSON"),
      icon: "icon-kapianshibie",
      iconSize: 18,
      onClick: handleCopyRecoJSON,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    // 保存为模板 (仅 Pipeline 节点)
    {
      key: "save-as-template",
      label: uiT("ui.flow.nodeContextMenu.saveAsTemplate", "保存为模板"),
      icon: "icon-biaodanmoban",
      iconSize: 16,
      onClick: handleSaveAsTemplate,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    // 便签颜色子菜单 (仅 Sticker 节点)
    {
      key: "sticker-color",
      label: uiT("ui.flow.nodeContextMenu.stickerColor", "便签颜色"),
      icon: "icon-tiaoseban",
      iconSize: 16,
      visible: (node) => node.type === NodeTypeEnum.Sticker,
      children: [
        {
          key: "color-yellow",
          label: uiT("ui.flow.nodeContextMenu.color.yellow", "黄色"),
          onClick: (node) => handleSetStickerColor(node, "yellow"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "yellow",
        },
        {
          key: "color-green",
          label: uiT("ui.flow.nodeContextMenu.color.green", "绿色"),
          onClick: (node) => handleSetStickerColor(node, "green"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "green",
        },
        {
          key: "color-blue",
          label: uiT("ui.flow.nodeContextMenu.color.blue", "蓝色"),
          onClick: (node) => handleSetStickerColor(node, "blue"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "blue",
        },
        {
          key: "color-pink",
          label: uiT("ui.flow.nodeContextMenu.color.pink", "粉色"),
          onClick: (node) => handleSetStickerColor(node, "pink"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "pink",
        },
        {
          key: "color-purple",
          label: uiT("ui.flow.nodeContextMenu.color.purple", "紫色"),
          onClick: (node) => handleSetStickerColor(node, "purple"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "purple",
        },
      ],
    },
    // 端点位置子菜单 (除 Sticker 和 Group 节点外)
    {
      key: "node-direction",
      label: uiT("ui.flow.nodeContextMenu.handleDirection", "端点位置"),
      icon: "icon-lianjie",
      iconSize: 16,
      visible: (node) =>
        node.type !== NodeTypeEnum.Sticker && node.type !== NodeTypeEnum.Group,
      children: HANDLE_DIRECTION_OPTIONS.map((option) => ({
        key: `direction-${option.value}`,
        label: option.label,
        onClick: (node) => handleSetNodeDirection(node, option.value),
        checked: (node) => getNodeDirection(node) === option.value,
      })),
    },
  ];

  config.push(
    // 分隔线
    {
      type: "divider",
      key: "divider-1",
    },
    // 删除
    {
      key: "delete-node",
      label: uiT("ui.flow.nodeContextMenu.delete", "删除"),
      icon: "icon-shanchu",
      iconSize: 16,
      onClick: handleDeleteNode,
      danger: true,
    },
  );

  return config;
}
