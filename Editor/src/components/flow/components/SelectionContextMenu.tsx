import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { memo, useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/shallow";
import IconFont from "../../iconfonts";
import type { IconNames } from "../../iconfonts";
import { useFlowStore } from "../../../stores/flow";
import {
  getSelectionContextMenuConfig,
  type SelectionContextMenuSelection,
  type SelectionContextMenuItem,
  type SelectionContextMenuWithChildren,
  type SelectionContextMenuSubItem,
} from "../selectionContextMenu";

interface SelectionContextMenuProps {
  position: { x: number; y: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function renderMenuLabel(
  icon: string | ReactNode,
  label: string,
  iconSize?: number,
  danger?: boolean
) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {typeof icon === "string" ? (
        <IconFont
          name={icon as IconNames}
          size={iconSize ?? 16}
          color={danger ? "#ff4d4f" : undefined}
        />
      ) : (
        icon
      )}
      <span>{label}</span>
    </div>
  );
}

export const SelectionContextMenu = memo<SelectionContextMenuProps>(
  ({ position, open, onOpenChange }) => {
    const selection = useFlowStore(
      useShallow(
        (state): SelectionContextMenuSelection => ({
          selectedNodes: state.selectedNodes,
          selectedEdges: state.selectedEdges,
        })
      )
    );

    const menuItems = useMemo<MenuProps["items"]>(() => {
      const config = getSelectionContextMenuConfig(selection);

      return config
        .filter((item) => {
          if ("visible" in item && item.visible) {
            return item.visible(selection);
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
            const submenuItem = item as SelectionContextMenuWithChildren;
            return {
              key: submenuItem.key,
              label: renderMenuLabel(
                submenuItem.icon,
                submenuItem.label,
                submenuItem.iconSize
              ),
              children: submenuItem.children.map(
                (child: SelectionContextMenuSubItem) => {
                  const disabled =
                    typeof child.disabled === "function"
                      ? child.disabled(selection)
                      : child.disabled;

                  return {
                    key: child.key,
                    label: child.label,
                    disabled,
                    onClick: async () => {
                      if (disabled) return;
                      await child.onClick(selection);
                      onOpenChange(false);
                    },
                  };
                }
              ),
            };
          }

          const menuItem = item as SelectionContextMenuItem;
          const disabled =
            typeof menuItem.disabled === "function"
              ? menuItem.disabled(selection)
              : menuItem.disabled;

          return {
            key: menuItem.key,
            label: renderMenuLabel(
              menuItem.icon,
              menuItem.label,
              menuItem.iconSize,
              menuItem.danger
            ),
            disabled,
            danger: menuItem.danger,
            onClick: async () => {
              if (disabled) return;
              await menuItem.onClick(selection);
              onOpenChange(false);
            },
          };
        });
    }, [selection, onOpenChange]);

    return (
      <Dropdown
        open={open}
        onOpenChange={onOpenChange}
        menu={{ items: menuItems }}
        trigger={["contextMenu"]}
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
    );
  }
);

SelectionContextMenu.displayName = "SelectionContextMenu";
