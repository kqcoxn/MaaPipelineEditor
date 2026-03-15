import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { memo, useMemo, useState, useEffect, useCallback } from "react";
import { CheckOutlined } from "@ant-design/icons";
import IconFont from "../../../iconfonts";
import type { IconNames } from "../../../iconfonts";
import {
  getNodeContextMenuConfig,
  type NodeContextMenuNode,
  type NodeContextMenuItem,
  type NodeContextMenuWithChildren,
  type NodeContextMenuSubItem,
} from "../nodeContextMenu";
import { useDebugStore } from "../../../../stores/debugStore";
import { NodeJsonEditorModal } from "../../../modals/NodeJsonEditorModal";
import { useFlowStore, type NodeType } from "../../../../stores/flow";

interface NodeContextMenuProps {
  node: NodeContextMenuNode;
  children: React.ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**节点右键菜单组件 */
export const NodeContextMenu = memo<NodeContextMenuProps>(
  ({ node, children, open, onOpenChange }) => {
    // 监听 debugMode 变化
    const debugMode = useDebugStore((state) => state.debugMode);

    // JSON 编辑器状态
    const [jsonEditorOpen, setJsonEditorOpen] = useState(false);

    // 处理 JSON 编辑保存
    const handleJsonEditorSave = useCallback(
      (nodeData: any) => {
        const { setNodes, nodes, saveHistory } = useFlowStore.getState();
        const newNodes = nodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: nodeData,
            };
          }
          return n;
        });
        setNodes(newNodes);
        // 从新节点列表中找到更新后的节点，设置为 targetNode
        const updatedNode = newNodes.find((n) => n.id === node.id);
        if (updatedNode) {
          useFlowStore.getState().setTargetNode(updatedNode);
        }
        saveHistory(0);
      },
      [node]
    );

    // 监听编辑 JSON 事件
    useEffect(() => {
      const handleEditJson = (e: CustomEvent) => {
        if (e.detail.node.id === node.id) {
          setJsonEditorOpen(true);
        }
      };
      window.addEventListener(
        "mpe:edit-node-json",
        handleEditJson as EventListener
      );
      return () => {
        window.removeEventListener(
          "mpe:edit-node-json",
          handleEditJson as EventListener
        );
      };
    }, [node]);

    // 生成菜单项
    const menuItems = useMemo<MenuProps["items"]>(() => {
      const config = getNodeContextMenuConfig(node);

      return config
        .filter((item) => {
          // 过滤不可见的菜单项
          if ("visible" in item && item.visible) {
            return item.visible(node);
          }
          return true;
        })
        .map((item) => {
          // 分隔线
          if ("type" in item && item.type === "divider") {
            return {
              type: "divider" as const,
              key: item.key,
            };
          }

          // 带子菜单的菜单项
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
                      ? child.checked(node)
                      : child.checked;
                  const isDisabled =
                    typeof child.disabled === "function"
                      ? child.disabled(node)
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
                        {isChecked && (
                          <CheckOutlined style={{ fontSize: 12 }} />
                        )}
                        <span style={{ marginLeft: isChecked ? 0 : 20 }}>
                          {child.label}
                        </span>
                      </div>
                    ),
                    onClick: () => {
                      if (!isDisabled) {
                        child.onClick(node);
                        onOpenChange(false);
                      }
                    },
                    disabled: isDisabled,
                  };
                }
              ),
            };
          }

          // 普通菜单项
          const menuItem = item as NodeContextMenuItem;
          const disabled =
            typeof menuItem.disabled === "function"
              ? menuItem.disabled(node)
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
              if (!disabled) {
                menuItem.onClick(node);
                onOpenChange(false);
              }
            },
            disabled,
            danger: menuItem.danger,
          };
        });
    }, [node, onOpenChange, debugMode]);

    return (
      <>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={["contextMenu"]}
          open={open}
          onOpenChange={onOpenChange}
        >
          {children}
        </Dropdown>
        <NodeJsonEditorModal
          open={jsonEditorOpen}
          onClose={() => setJsonEditorOpen(false)}
          node={node as unknown as NodeType}
          onSave={handleJsonEditorSave}
        />
      </>
    );
  }
);

NodeContextMenu.displayName = "NodeContextMenu";
