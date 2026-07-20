import style from "../../../styles/panels/FieldPanel.module.less";
import { memo, useMemo, useCallback } from "react";
import { Input, Popover, Select } from "antd";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import {
  useFlowStore,
  type StickerNodeType,
  type StickerColorTheme,
} from "../../../stores/flow";

const { TextArea } = Input;

export const StickerEditor = memo(
  ({ currentNode }: { currentNode: StickerNodeType }) => {
    const { t } = useTranslation();
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const saveHistory = useFlowStore((state) => state.saveHistory);

    const colorOptions = useMemo(
      () =>
        (
          [
            ["yellow", t("ui.panels.stickerEditor.colors.yellow", "黄色")],
            ["green", t("ui.panels.stickerEditor.colors.green", "绿色")],
            ["blue", t("ui.panels.stickerEditor.colors.blue", "蓝色")],
            ["pink", t("ui.panels.stickerEditor.colors.pink", "粉色")],
            ["purple", t("ui.panels.stickerEditor.colors.purple", "紫色")],
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

    // 内容
    const currentContent = useMemo(
      () => currentNode.data.content ?? "",
      [currentNode.data.content],
    );

    // 颜色
    const currentColor = useMemo(
      () => currentNode.data.color ?? "yellow",
      [currentNode.data.color],
    );

    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "direct", "label", e.target.value);
      },
      [currentNode.id, setNodeData],
    );

    const onContentChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNodeData(currentNode.id, "sticker", "content", e.target.value);
      },
      [currentNode.id, setNodeData],
    );

    const onColorChange = useCallback(
      (value: StickerColorTheme) => {
        setNodeData(currentNode.id, "sticker", "color", value);
        saveHistory(0, {
          category: "node",
          action: "update",
          description: t(
            "ui.panels.stickerEditor.history.changeColor",
            "更改便签颜色",
          ),
          targetIds: [currentNode.id],
        });
      },
      [currentNode.id, setNodeData, saveHistory, t],
    );

    return (
      <div className={style.list}>
        {/* 便签标题 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={t("ui.panels.stickerEditor.title.label", "标题")}
            content={t("ui.panels.stickerEditor.title.content", "便签标题")}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              {t("ui.panels.stickerEditor.title.label", "标题")}
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder={t(
                "ui.panels.stickerEditor.title.placeholder",
                "便签标题",
              )}
              value={currentLabel}
              onChange={onLabelChange}
              allowClear
            />
          </div>
        </div>

        {/* 便签颜色 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={t("ui.panels.stickerEditor.color.title", "颜色")}
            content={t(
              "ui.panels.stickerEditor.color.content",
              "便签颜色主题",
            )}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              {t("ui.panels.stickerEditor.color.title", "颜色")}
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

        {/* 便签内容 */}
        <div className={style.item} style={{ alignItems: "flex-start" }}>
          <Popover
            placement="left"
            title={t("ui.panels.stickerEditor.content.label", "内容")}
            content={t(
              "ui.panels.stickerEditor.content.tooltip",
              "便签正文内容",
            )}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48, paddingTop: 5 }}
            >
              {t("ui.panels.stickerEditor.content.label", "内容")}
            </div>
          </Popover>
          <div className={style.value}>
            <TextArea
              placeholder={t(
                "ui.panels.stickerEditor.content.placeholder",
                "在此输入便签内容...",
              )}
              value={currentContent}
              onChange={onContentChange}
              rows={6}
              autoSize={{ minRows: 4, maxRows: 12 }}
            />
          </div>
        </div>
      </div>
    );
  },
);
