import { memo, useMemo, useCallback } from "react";
import { Input, Select, Popover } from "antd";
import classNames from "classnames";
import {
  useFlowStore,
  type GroupNodeType,
  type GroupColorTheme,
} from "../../../stores/flow";
import style from "../../../styles/FieldPanel.module.less";

const COLOR_OPTIONS = [
  { value: "blue", label: "蓝色" },
  { value: "green", label: "绿色" },
  { value: "purple", label: "紫色" },
  { value: "orange", label: "橙色" },
  { value: "gray", label: "灰色" },
];

/**分组编辑器 */
export const GroupEditor = memo(
  ({ currentNode }: { currentNode: GroupNodeType }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const saveHistory = useFlowStore((state) => state.saveHistory);

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label]
    );

    // 颜色
    const currentColor = useMemo(
      () => currentNode.data.color ?? "blue",
      [currentNode.data.color]
    );

    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "direct", "label", e.target.value);
      },
      [currentNode.id, setNodeData]
    );

    const onColorChange = useCallback(
      (value: GroupColorTheme) => {
        setNodeData(currentNode.id, "direct", "color", value);
        saveHistory(0);
      },
      [currentNode.id, setNodeData, saveHistory]
    );

    return (
      <div className={style.list}>
        {/* 分组名称 */}
        <div className={style.item}>
          <Popover placement="left" title={"名称"} content={"分组名称"}>
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              名称
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder="分组名称"
              value={currentLabel}
              onChange={onLabelChange}
              allowClear
            />
          </div>
        </div>

        {/* 分组颜色 */}
        <div className={style.item}>
          <Popover placement="left" title={"颜色"} content={"分组颜色主题"}>
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
      </div>
    );
  }
);
