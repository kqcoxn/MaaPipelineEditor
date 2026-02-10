import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback } from "react";
import { Input, Popover, Select } from "antd";
import classNames from "classnames";
import {
  useFlowStore,
  type StickerNodeType,
  type StickerColorTheme,
} from "../../../stores/flow";

const { TextArea } = Input;

const COLOR_OPTIONS: { value: StickerColorTheme; label: string }[] = [
  { value: "yellow", label: "黄色" },
  { value: "green", label: "绿色" },
  { value: "blue", label: "蓝色" },
  { value: "pink", label: "粉色" },
  { value: "purple", label: "紫色" },
];

export const StickerEditor = memo(
  ({ currentNode }: { currentNode: StickerNodeType }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const saveHistory = useFlowStore((state) => state.saveHistory);

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label]
    );

    // 内容
    const currentContent = useMemo(
      () => currentNode.data.content ?? "",
      [currentNode.data.content]
    );

    // 颜色
    const currentColor = useMemo(
      () => currentNode.data.color ?? "yellow",
      [currentNode.data.color]
    );

    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "direct", "label", e.target.value);
      },
      [currentNode.id, setNodeData]
    );

    const onContentChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNodeData(currentNode.id, "sticker", "content", e.target.value);
      },
      [currentNode.id, setNodeData]
    );

    const onColorChange = useCallback(
      (value: StickerColorTheme) => {
        setNodeData(currentNode.id, "sticker", "color", value);
        saveHistory(0);
      },
      [currentNode.id, setNodeData, saveHistory]
    );

    return (
      <div className={style.list}>
        {/* 便签标题 */}
        <div className={style.item}>
          <Popover placement="left" title={"标题"} content={"便签标题"}>
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              标题
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder="便签标题"
              value={currentLabel}
              onChange={onLabelChange}
              allowClear
            />
          </div>
        </div>

        {/* 便签颜色 */}
        <div className={style.item}>
          <Popover placement="left" title={"颜色"} content={"便签颜色主题"}>
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              颜色
            </div>
          </Popover>
          <div className={style.value}>
            <Select
              value={currentColor}
              onChange={onColorChange}
              options={COLOR_OPTIONS}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* 便签内容 */}
        <div className={style.item} style={{ alignItems: "flex-start" }}>
          <Popover placement="left" title={"内容"} content={"便签正文内容"}>
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48, paddingTop: 5 }}
            >
              内容
            </div>
          </Popover>
          <div className={style.value}>
            <TextArea
              placeholder="在此输入便签内容..."
              value={currentContent}
              onChange={onContentChange}
              rows={6}
              autoSize={{ minRows: 4, maxRows: 12 }}
            />
          </div>
        </div>
      </div>
    );
  }
);
