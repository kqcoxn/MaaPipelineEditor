import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckOutlined } from "@ant-design/icons";

import IconFont from "../../../iconfonts";
import type { IconNames } from "../../../iconfonts";
import {
  getNodeContextMenuConfig,
  type NodeContextMenuItem,
  type NodeContextMenuNode,
  type NodeContextMenuSubItem,
  type NodeContextMenuWithChildren,
} from "../nodeContextMenu";
import { NodeJsonEditorModal } from "../../../modals/NodeJsonEditorModal";
import { useFlowStore, type NodeType } from "../../../../stores/flow";
import { useFileStore } from "@/stores/project/fileStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { ensureDebugCapabilitiesRequested } from "../../../../features/debug/actions/capabilityActions";

interface CanvasNodeContextMenuProps {
  nodeId: string | null;
  position: { x: number; y: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 画布级节点右键菜单和 JSON 编辑器宿主。 */
export const CanvasNodeContextMenu = memo<CanvasNodeContextMenuProps>(
  ({ nodeId, position, open, onOpenChange }) => {
    const [jsonEditorNodeId, setJsonEditorNodeId] = useState<string | null>(
      null,
    );
    const [jsonEditorFileName, setJsonEditorFileName] = useState<string | null>(
      null,
    );
    const debugCapabilities = useDebugSessionStore(
      (state) => state.capabilities,
    );
    const debugCapabilityStatus = useDebugSessionStore(
      (state) => state.capabilityStatus,
    );
    const localBridgeConnected = useWSStore((state) => state.connected);
    const currentFileName = useFileStore((state) => state.currentFile.fileName);
    const previousFileNameRef = useRef(currentFileName);
    const contextNode = useFlowStore(
      (state) =>
        (nodeId ? state.nodeById.get(nodeId) : undefined) as
          | NodeContextMenuNode
          | undefined,
    );
    const jsonEditorNode = useFlowStore(
      (state) =>
        (jsonEditorNodeId
          ? state.nodeById.get(jsonEditorNodeId)
          : undefined) as NodeType | undefined,
    );

    // 外部入口仍可通过事件打开 JSON，但事件只由这个宿主监听一次。
    useEffect(() => {
      const handleEditJson = (event: Event) => {
        const detail = (event as CustomEvent<{ node?: { id?: string } }>)
          .detail;
        const targetNodeId = detail?.node?.id;
        if (!targetNodeId) return;

        setJsonEditorNodeId(targetNodeId);
        setJsonEditorFileName(currentFileName);
        onOpenChange(false);
      };

      window.addEventListener("mpe:edit-node-json", handleEditJson);
      return () => {
        window.removeEventListener("mpe:edit-node-json", handleEditJson);
      };
    }, [currentFileName, onOpenChange]);

    // 目标节点删除、切换文件或撤销后，关闭悬空菜单和编辑器。
    useEffect(() => {
      if (open && !contextNode) {
        onOpenChange(false);
      }
    }, [contextNode, onOpenChange, open]);

    useEffect(() => {
      if (previousFileNameRef.current === currentFileName) return;

      previousFileNameRef.current = currentFileName;
      setJsonEditorNodeId(null);
      setJsonEditorFileName(null);
      onOpenChange(false);
    }, [currentFileName, onOpenChange]);

    useEffect(() => {
      if (jsonEditorNodeId && !jsonEditorNode) {
        setJsonEditorNodeId(null);
        setJsonEditorFileName(null);
      }
    }, [jsonEditorNode, jsonEditorNodeId]);

    const handleJsonEditorSave = useCallback(
      (nodeData: NodeType["data"]) => {
        if (!jsonEditorNodeId) return;

        const { nodes, setNodes, saveHistory, setTargetNode } =
          useFlowStore.getState();
        const updatedNodes = nodes.map((node) =>
          node.id === jsonEditorNodeId
            ? {
                ...node,
                data: nodeData,
              }
            : node,
        );
        const updatedNode = updatedNodes.find(
          (node) => node.id === jsonEditorNodeId,
        );
        if (!updatedNode) return;

        setNodes(updatedNodes);
        setTargetNode(updatedNode);
        saveHistory(0, {
          category: "node",
          action: "update",
          description: "JSON 编辑节点数据",
          targetIds: [jsonEditorNodeId],
        });
      },
      [jsonEditorNodeId],
    );

    const handleDropdownOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (
          nextOpen &&
          localBridgeConnected &&
          !debugCapabilities &&
          debugCapabilityStatus !== "loading"
        ) {
          ensureDebugCapabilitiesRequested();
        }
        onOpenChange(nextOpen);
      },
      [
        debugCapabilities,
        debugCapabilityStatus,
        localBridgeConnected,
        onOpenChange,
      ],
    );

    const menuItems = useMemo<MenuProps["items"]>(() => {
      if (!contextNode) return [];

      const config = getNodeContextMenuConfig(contextNode, {
        debugCapabilities,
      });

      return config
        .filter((item) => {
          if ("visible" in item && item.visible) {
            return item.visible(contextNode);
          }
          return true;
        })
        .map((item) => {
          if ("type" in item && item.type === "divider") {
            return {
              type: "divider" as const,
              key: item.key,
            };
          }

          if ("children" in item) {
            const submenuItem = item as NodeContextMenuWithChildren;
            return {
              key: submenuItem.key,
              label: (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {typeof submenuItem.icon === "string" ? (
                    <IconFont
                      name={submenuItem.icon as IconNames}
                      size={submenuItem.iconSize ?? 16}
                    />
                  ) : (
                    submenuItem.icon
                  )}
                  <span>{submenuItem.label}</span>
                </div>
              ),
              children: submenuItem.children.map(
                (child: NodeContextMenuSubItem) => {
                  const isChecked =
                    typeof child.checked === "function"
                      ? child.checked(contextNode)
                      : child.checked;
                  const isDisabled =
                    typeof child.disabled === "function"
                      ? child.disabled(contextNode)
                      : child.disabled;

                  return {
                    key: child.key,
                    label: (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 60,
                        }}
                      >
                        {isChecked && <CheckOutlined style={{ fontSize: 12 }} />}
                        <span style={{ marginLeft: isChecked ? 0 : 20 }}>
                          {child.label}
                        </span>
                      </div>
                    ),
                    onClick: () => {
                      if (isDisabled) return;
                      child.onClick(contextNode);
                      onOpenChange(false);
                    },
                    disabled: isDisabled,
                  };
                },
              ),
            };
          }

          const menuItem = item as NodeContextMenuItem;
          const disabled =
            typeof menuItem.disabled === "function"
              ? menuItem.disabled(contextNode)
              : menuItem.disabled;

          return {
            key: menuItem.key,
            label: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {typeof menuItem.icon === "string" ? (
                  <IconFont
                    name={menuItem.icon as IconNames}
                    size={menuItem.iconSize ?? 16}
                    color={menuItem.danger ? "#ff4d4f" : undefined}
                  />
                ) : (
                  menuItem.icon
                )}
                <span>{menuItem.label}</span>
              </div>
            ),
            onClick: () => {
              if (disabled) return;
              menuItem.onClick(contextNode);
              onOpenChange(false);
            },
            disabled,
            danger: menuItem.danger,
          };
        });
    }, [contextNode, debugCapabilities, onOpenChange]);

    return (
      <>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={["contextMenu"]}
          open={open && !!contextNode}
          onOpenChange={handleDropdownOpenChange}
        >
          {position ? (
            <div
              style={{
                position: "fixed",
                left: position.x,
                top: position.y,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          ) : (
            <span />
          )}
        </Dropdown>
        <NodeJsonEditorModal
          open={
            !!jsonEditorNodeId &&
            !!jsonEditorNode &&
            jsonEditorFileName === currentFileName
          }
          onClose={() => {
            setJsonEditorNodeId(null);
            setJsonEditorFileName(null);
          }}
          node={jsonEditorNode ?? null}
          onSave={handleJsonEditorSave}
        />
      </>
    );
  },
);

CanvasNodeContextMenu.displayName = "CanvasNodeContextMenu";
