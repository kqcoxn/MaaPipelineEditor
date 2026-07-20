import { memo, useMemo, useCallback } from "react";
import { Input, Select, Popover } from "antd";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import {
  useFlowStore,
  type GroupNodeType,
  type GroupColorTheme,
} from "../../../stores/flow";
import style from "../../../styles/panels/FieldPanel.module.less";

/**分组编辑器 */
export const GroupEditor = memo(
  ({ currentNode }: { currentNode: GroupNodeType }) => {
    const { t } = useTranslation();
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const saveHistory = useFlowStore((state) => state.saveHistory);

    const colorOptions = useMemo(
      () =>
        (
          [
            ["blue", t("ui.panels.groupEditor.colors.blue", "蓝色")],
            ["green", t("ui.panels.groupEditor.colors.green", "绿色")],
            ["purple", t("ui.panels.groupEditor.colors.purple", "紫色")],
            ["orange", t("ui.panels.groupEditor.colors.orange", "橙色")],
            ["gray", t("ui.panels.groupEditor.colors.gray", "灰色")],
          ] as const
        ).map(([value, label]) => ({
          value,
          label,
        })),
      [t],
    );

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label],
    );

    // 颜色
    const currentColor = useMemo(
      () => currentNode.data.color ?? "blue",
      [currentNode.data.color],
    );

    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "direct", "label", e.target.value);
      },
      [currentNode.id, setNodeData],
    );

    const onColorChange = useCallback(
      (value: GroupColorTheme) => {
        setNodeData(currentNode.id, "direct", "color", value);
        saveHistory(0, {
          category: "group",
          action: "update",
          description: t(
            "ui.panels.groupEditor.history.changeColor",
            "更改分组颜色",
          ),
          targetIds: [currentNode.id],
        });
      },
      [currentNode.id, setNodeData, saveHistory, t],
    );

    return (
      <div className={style.list}>
        {/* 分组名称 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={t("ui.panels.groupEditor.name.title", "名称")}
            content={t("ui.panels.groupEditor.name.content", "分组名称")}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              {t("ui.panels.groupEditor.name.title", "名称")}
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder={t(
                "ui.panels.groupEditor.name.placeholder",
                "分组名称",
              )}
              value={currentLabel}
              onChange={onLabelChange}
              allowClear
            />
          </div>
        </div>

        {/* 分组颜色 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={t("ui.panels.groupEditor.color.title", "颜色")}
            content={t(
              "ui.panels.groupEditor.color.content",
              "分组颜色主题",
            )}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              {t("ui.panels.groupEditor.color.title", "颜色")}
            </div>
          </Popover>
          <div className={style.value}>
            <Select
              value={currentColor}
              onChange={onColorChange}
              options={colorOptions}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>
    );
  },
);
