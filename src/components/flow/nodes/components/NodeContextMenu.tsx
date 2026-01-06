import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { memo, useMemo } from "react";
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

interface NodeContextMenuProps {
  node: NodeContextMenuNode;
  children: React.ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**节点右键菜单组件 */
export const NodeContextMenu = memo<NodeContextMenuProps>(
  ({ node, children, open, onOpenChange }) => {
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
              children: submenuItem.children.map((child: NodeContextMenuSubItem) => {
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
                      {isChecked && <CheckOutlined style={{ fontSize: 12 }} />}
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
              }),
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
    }, [node, onOpenChange]);

    return (
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["contextMenu"]}
        open={open}
        onOpenChange={onOpenChange}
      >
        {children}
      </Dropdown>
    );
  }
);

NodeContextMenu.displayName = "NodeContextMenu";
