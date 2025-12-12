import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback } from "react";
import { Popover, Input } from "antd";
import classNames from "classnames";
import { useFlowStore, type AnchorNodeType } from "../../../stores/flow";

export const AnchorEditor = memo(
  ({ currentNode }: { currentNode: AnchorNodeType }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label]
    );
    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "", "label", e.target.value);
      },
      [currentNode]
    );

    return (
      <div className={style.list}>
        {/* 节点名 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={"key"}
            content={"重定向节点名，编译时会添加 [Anchor] 前缀"}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              key
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder="重定向节点名 (编译时添加 [Anchor] 前缀)"
              value={currentLabel}
              onChange={onLabelChange}
            />
          </div>
        </div>
      </div>
    );
  }
);
