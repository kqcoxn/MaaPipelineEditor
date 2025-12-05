import style from "../../styles/ToolPanel.module.less";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { message, Tooltip, AutoComplete } from "antd";
import type { AutoCompleteProps } from "antd";
import classNames from "classnames";
import { useDebounceFn } from "ahooks";
import IconFont from "../iconfonts";
import { useFlowStore, type NodeType } from "../../stores/flow";

/**搜索工具 */
function SearchPanel() {
  // store
  const nodes = useFlowStore((state) => state.nodes);
  const instance = useFlowStore((state) => state.instance);

  // 状态
  const [searchValue, setSearchValue] = useState("");
  const [options, setOptions] = useState<AutoCompleteProps["options"]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<any>(null);

  // 获取所有节点标签列表
  const getAllNodeLabels = useCallback(() => {
    return nodes.map((node: NodeType) => node.data.label);
  }, [nodes]);

  // 防抖搜索
  const { run: handleSearch } = useDebounceFn(
    (value: string) => {
      if (!value.trim()) {
        setOptions([]);
        return;
      }

      const labels = getAllNodeLabels();
      const filtered = labels
        .filter((label) => label.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5)
        .map((label) => ({ value: label, label }));
      setOptions(filtered);
    },
    { wait: 300 }
  );

  // 选中节点并聚焦
  const focusNode = useCallback(
    (label: string) => {
      const targetNode = nodes.find(
        (node: NodeType) => node.data.label === label
      );
      if (!targetNode) {
        message.warning("未找到该节点");
        return;
      }

      // 选中节点
      useFlowStore.getState().updateNodes(
        nodes.map((node: NodeType) => ({
          type: "select" as const,
          id: node.id,
          selected: node.id === targetNode.id,
        }))
      );

      // 聚焦视图到该节点
      if (instance) {
        const { x, y } = targetNode.position;
        const { width = 200, height = 100 } = targetNode.measured || {};
        instance.setCenter(x + width / 2, y + height / 2, {
          duration: 500,
          zoom: 1.5,
        });
      }

      message.success(`已定位到节点: ${label}`);
      // 关闭下拉提示，但不清空内容
      setIsOpen(false);
      setOptions([]);
    },
    [nodes, instance]
  );

  // 处理选择
  const handleSelect = useCallback(
    (value: string) => {
      focusNode(value);
    },
    [focusNode]
  );

  // 普通搜索
  const handleSearchClick = useCallback(() => {
    if (searchValue.trim()) {
      focusNode(searchValue.trim());
    } else {
      message.info("请输入节点名称");
    }
  }, [searchValue, focusNode]);

  // AI搜索
  const handleAISearchClick = useCallback(() => {
    message.info("AI搜索功能开发中...");
  }, []);

  // 处理输入变化
  const handleChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (value.trim()) {
        setIsOpen(true);
      }
      handleSearch(value);
    },
    [handleSearch]
  );

  // 处理回车
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && searchValue.trim()) {
        e.preventDefault();
        focusNode(searchValue.trim());
      }
    },
    [searchValue, focusNode]
  );

  // 焦点不在时关闭下拉
  useEffect(() => {
    if (!isFocused) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setOptions([]);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  // 渲染
  const panelClass = useMemo(
    () => classNames(style.panel, style["h-panel"], style["search-panel"]),
    []
  );

  return (
    <div className={panelClass}>
      <AutoComplete
        ref={searchRef}
        className={style["search-input"]}
        options={options}
        value={searchValue}
        open={isOpen && (options?.length ?? 0) > 0}
        onChange={handleChange}
        onSelect={handleSelect}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="搜索节点..."
        size="large"
        allowClear
      />
      <div className={style["search-buttons"]}>
        <Tooltip placement="bottom" title="搜索节点">
          <IconFont
            className={style["search-icon"]}
            name="icon-AIsousuo1"
            size={28}
            color={"#0075ff"}
            onClick={handleSearchClick}
          />
        </Tooltip>
        <div className={style.devider}>
          <div></div>
        </div>
        <Tooltip placement="bottom" title="AI搜索（开发中）">
          <IconFont
            className={style["search-icon"]}
            name="icon-AIsousuo"
            size={28}
            color={"#5f50ff"}
            onClick={handleAISearchClick}
            style={{ marginRight: 6 }}
          />
        </Tooltip>
      </div>
    </div>
  );
}

export default memo(SearchPanel);
