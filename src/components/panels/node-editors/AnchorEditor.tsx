import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback, useState } from "react";
import { Popover, AutoComplete } from "antd";
import classNames from "classnames";
import { useFlowStore, type AnchorNodeType } from "../../../stores/flow";
import { crossFileService } from "../../../services/crossFileService";

export const AnchorEditor = memo(
  ({ currentNode }: { currentNode: AnchorNodeType }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const [searchValue, setSearchValue] = useState("");

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label]
    );

    // 获取自动完成选项
    const autoCompleteOptions = useMemo(() => {
      const options = crossFileService.getAutoCompleteOptions();
      if (!searchValue) return options.slice(0, 50);

      const lowerSearch = searchValue.toLowerCase();
      return options
        .filter(
          (opt) =>
            opt.label.toLowerCase().includes(lowerSearch) ||
            opt.description.toLowerCase().includes(lowerSearch)
        )
        .slice(0, 50);
    }, [searchValue]);

    // 渲染选项
    const renderOptions = useMemo(
      () =>
        autoCompleteOptions.map((opt) => ({
          value: opt.value,
          label: opt.label,
          nodeName: opt.label,
          filePath: opt.description,
        })),
      [autoCompleteOptions]
    );

    const onLabelChange = useCallback(
      (value: string) => {
        setSearchValue(value);
        setNodeData(currentNode.id, "", "label", value);
      },
      [currentNode, setNodeData]
    );

    const onSelect = useCallback(
      (value: string) => {
        setSearchValue("");
        setNodeData(currentNode.id, "", "label", value);
      },
      [currentNode, setNodeData]
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
            <AutoComplete
              placeholder="重定向节点名 (编译时添加 [Anchor] 前缀)"
              value={currentLabel}
              options={renderOptions}
              onChange={onLabelChange}
              onSelect={onSelect}
              onSearch={setSearchValue}
              style={{ width: "100%" }}
              allowClear
              // 自定义下拉选项渲染
              optionRender={(option) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 500 }}>
                    {option.data.nodeName}
                  </span>
                  <span style={{ color: "#888", fontSize: 12 }}>
                    {option.data.filePath}
                  </span>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    );
  }
);
