import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback } from "react";
import { Popover, Input } from "antd";
import classNames from "classnames";
import { useFlowStore, type ExternalNodeType } from "../../../stores/flow";

export const ExternalEditor = memo(
  ({ currentNode }: { currentNode: ExternalNodeType }) => {
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
            content={"节点名，转录时不会添加 prefix 前缀"}
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
              placeholder="节点名 (转录时不会添加前缀)"
              value={currentLabel}
              onChange={onLabelChange}
            />
          </div>
        </div>
      </div>
    );
  }
);
