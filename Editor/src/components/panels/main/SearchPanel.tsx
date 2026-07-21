import style from "../../../styles/panels/ToolPanel.module.less";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { message, Tooltip, AutoComplete } from "antd";
import type { AutoCompleteProps } from "antd";
import { DownOutlined, SearchOutlined } from "@ant-design/icons";
import classNames from "classnames";
import { useDebounceFn } from "ahooks";
import {
  useFlowStore,
  getNodeAbsolutePosition,
  type NodeType,
} from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import {
  crossFileService,
  type CrossFileNodeInfo,
} from "../../../services/crossFileService";
import { NodeListPanel } from "./node-list";
import { useEmbedMode } from "../../../hooks/useEmbedMode";

/**搜索工具 */
function SearchPanel() {
  // store
  const instance = useFlowStore((state) => state.instance);
  const enableCrossFileSearch = useConfigStore(
    (state) => state.configs.enableCrossFileSearch,
  );

  // 嵌入模式权限控制
  const { isEmbed, isCapAllowed } = useEmbedMode();
  const allowSearch = !isEmbed || isCapAllowed("allowSearch");

  // 状态
  const [searchValue, setSearchValue] = useState("");
  const [options, setOptions] = useState<AutoCompleteProps["options"]>([]);
  const [searchResults, setSearchResults] = useState<CrossFileNodeInfo[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const {
    isActive: showNodeList,
    isDisplaced,
    activate: activateNodeList,
    deactivate: deactivateNodeList,
  } = usePanelOccupancy("nodeList");
  const searchRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 被其他面板排挤时执行 close 反应
  useEffect(() => {
    if (isDisplaced && showNodeList) {
      deactivateNodeList();
    }
  }, [isDisplaced, showNodeList, deactivateNodeList]);

  // 防抖搜索
  const { run: handleSearch } = useDebounceFn(
    (value: string) => {
      if (!value.trim()) {
        setOptions([]);
        setSearchResults([]);
        return;
      }

      // 使用跨文件搜索服务
      const results = crossFileService.searchNodes(value, {
        crossFile: enableCrossFileSearch,
        limit: 10,
      });

      setSearchResults(results);

      // 渲染选项，显示文件路径提示
      const filtered = results.map((node, index) => ({
        value: `${node.label}__${index}`,
        label: node.label,
        nodeName: node.label,
        filePath: node.isCurrentFile ? "当前文件" : node.relativePath,
      }));
      setOptions(filtered);
    },
    { wait: 300 },
  );

  // 选中节点并聚焦
  const focusNodeInCurrentFile = useCallback(
    (label: string) => {
      const currentNodes = useFlowStore.getState().nodes;
      const targetNode = currentNodes.find(
        (node: NodeType) => node.data.label === label,
      );
      if (!targetNode) {
        message.warning("未找到该节点");
        return;
      }

      // 选中节点
      useFlowStore.getState().updateNodes(
        currentNodes.map((node: NodeType) => ({
          type: "select" as const,
          id: node.id,
          selected: node.id === targetNode.id,
        })),
      );

      // 聚焦视图到该节点
      if (instance) {
        const { x, y } = getNodeAbsolutePosition(targetNode, currentNodes);
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
      setSearchResults([]);
    },
    [instance],
  );

  // 跨文件跳转到节点
  const navigateToNode = useCallback(async (nodeInfo: CrossFileNodeInfo) => {
    const success = await crossFileService.navigateToNode(nodeInfo);
    if (success) {
      message.success(
        nodeInfo.isCurrentFile
          ? `已定位到节点: ${nodeInfo.label}`
          : `已跳转到 ${nodeInfo.relativePath} 并定位节点: ${nodeInfo.label}`,
      );
    } else {
      message.warning("跳转失败");
    }
    setIsOpen(false);
    setOptions([]);
    setSearchResults([]);
  }, []);

  // 处理选择
  const handleSelect = useCallback(
    (value: string) => {
      // 从 value 中解析出索引（格式：label__index）
      const match = value.match(/^(.+)__([0-9]+)$/);
      if (match) {
        const index = parseInt(match[2], 10);
        const nodeInfo = searchResults[index];
        if (nodeInfo) {
          // 清空输入框
          setSearchValue("");
          navigateToNode(nodeInfo);
          return;
        }
      }
      // 兜底：直接在当前文件搜索
      setSearchValue("");
      focusNodeInCurrentFile(value);
    },
    [searchResults, navigateToNode, focusNodeInCurrentFile],
  );

  // 普通搜索
  const handleSearchClick = useCallback(() => {
    if (searchValue.trim()) {
      // 如果有搜索结果，跳转到第一个
      if (searchResults.length > 0) {
        navigateToNode(searchResults[0]);
      } else {
        // 没有结果时执行即时搜索
        const results = crossFileService.searchNodes(searchValue.trim(), {
          crossFile: enableCrossFileSearch,
          limit: 1,
        });
        if (results.length > 0) {
          navigateToNode(results[0]);
        } else {
          message.warning("未找到该节点");
        }
      }
    } else {
      message.info("请输入节点名称");
    }
  }, [searchValue, searchResults, enableCrossFileSearch, navigateToNode]);

  // 处理输入变化
  const handleChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (value.trim()) {
        setIsOpen(true);
      }
      handleSearch(value);
    },
    [handleSearch],
  );

  // 处理回车
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && searchValue.trim()) {
        e.preventDefault();
        // 如果有搜索结果，跳转到第一个
        if (searchResults.length > 0) {
          navigateToNode(searchResults[0]);
        } else {
          focusNodeInCurrentFile(searchValue.trim());
        }
      }
    },
    [searchValue, searchResults, navigateToNode, focusNodeInCurrentFile],
  );

  // 焦点不在时关闭下拉
  useEffect(() => {
    if (!isFocused) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setOptions([]);
        setSearchResults([]);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  // 渲染
  const panelClass = useMemo(
    () => classNames(style.panel, style["h-panel"], style["search-panel"]),
    [],
  );

  // 若搜索被禁用，整个面板不渲染
  if (!allowSearch) return null;

  return (
    <div ref={containerRef} className={panelClass}>
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
        // 自定义下拉选项渲染
        optionRender={(option) => (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>{option.data.nodeName}</span>
            <span style={{ color: "#888", fontSize: 12 }}>
              {option.data.filePath}
            </span>
          </div>
        )}
      />
      <div className={style["search-buttons"]}>
        <Tooltip placement="bottom" title="搜索节点">
          <SearchOutlined
            className={style["search-icon"]}
            onClick={handleSearchClick}
            style={{ fontSize: 28, color: "#0075ff" }}
          />
        </Tooltip>
        <div className={style.devider}>
          <div></div>
        </div>
        <Tooltip placement="left" title="节点列表">
          <DownOutlined
            className={classNames(
              style["search-icon"],
              style["dropdown-icon"],
              {
                [style.active]: showNodeList,
              },
            )}
            onClick={() => {
              if (showNodeList) {
                deactivateNodeList();
              } else {
                activateNodeList();
              }
            }}
            style={{ fontSize: 14, marginRight: 6 }}
          />
        </Tooltip>
      </div>
      {/* 节点列表面板 */}
      {createPortal(
        <NodeListPanel
          visible={showNodeList}
          onClose={deactivateNodeList}
          anchorEl={containerRef.current}
        />,
        document.body,
      )}
    </div>
  );
}

export default memo(SearchPanel);
