import style from "../../../styles/panels/ToolPanel.module.less";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { message, Tooltip, AutoComplete, Spin } from "antd";
import type { AutoCompleteProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import classNames from "classnames";
import { useDebounceFn } from "ahooks";
import IconFont from "../../iconfonts";
import { useFlowStore, type NodeType } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import { OpenAIChat } from "../../../utils/ai/openai";
import { buildAISearchPrompt } from "../../../utils/ai/aiPrompts";
import { NodeTypeEnum } from "../../flow/nodes";
import {
  crossFileService,
  type CrossFileNodeInfo,
} from "../../../services/crossFileService";
import { NodeListPanel } from "./node-list";

/**搜索工具 */
function SearchPanel() {
  // store
  const nodes = useFlowStore((state) => state.nodes);
  const instance = useFlowStore((state) => state.instance);
  const enableCrossFileSearch = useConfigStore(
    (state) => state.configs.enableCrossFileSearch,
  );

  // 状态
  const [searchValue, setSearchValue] = useState("");
  const [options, setOptions] = useState<AutoCompleteProps["options"]>([]);
  const [searchResults, setSearchResults] = useState<CrossFileNodeInfo[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const {
    isActive: showNodeList,
    isDisplaced,
    activate: activateNodeList,
    deactivate: deactivateNodeList,
  } = usePanelOccupancy("nodeList");
  const searchRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiChatRef = useRef<OpenAIChat | null>(null);

  // 被其他面板排挤时执行 close 反应
  useEffect(() => {
    if (isDisplaced && showNodeList) {
      deactivateNodeList();
    }
  }, [isDisplaced, showNodeList, deactivateNodeList]);

  // 获取所有节点标签列表
  const getAllNodeLabels = useCallback(() => {
    return nodes.map((node: NodeType) => node.data.label);
  }, [nodes]);

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
      const targetNode = nodes.find(
        (node: NodeType) => node.data.label === label,
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
        })),
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
      setSearchResults([]);
    },
    [nodes, instance],
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

  // 构建节点上下文信息
  const buildNodesContext = useCallback(() => {
    return nodes.map((node: NodeType) => {
      const baseInfo = {
        label: node.data.label,
        type: node.type,
      };

      // Pipeline 节点包含识别和动作信息
      if (node.type === NodeTypeEnum.Pipeline) {
        const pipelineNode = node as any;
        return {
          ...baseInfo,
          recognition: {
            type: pipelineNode.data.recognition?.type || "无",
            param: pipelineNode.data.recognition?.param || {},
          },
          action: {
            type: pipelineNode.data.action?.type || "无",
            param: pipelineNode.data.action?.param || {},
          },
          others: pipelineNode.data.others || {},
        };
      }

      return baseInfo;
    });
  }, [nodes]);

  // AI搜索
  const handleAISearchClick = useCallback(async () => {
    if (!searchValue.trim()) {
      message.info("请输入搜索内容");
      return;
    }

    setAiSearching(true);
    const userInput = searchValue.trim();

    try {
      // 构建节点上下文
      const nodesContext = buildNodesContext();
      if (nodesContext.length === 0) {
        message.warning("当前没有任何节点");
        return;
      }

      // 构建提示词
      const systemPrompt = buildAISearchPrompt(
        JSON.stringify(nodesContext, null, 2),
      );

      // 创建AI实例
      const aiChat = new OpenAIChat({
        systemPrompt,
        historyLimit: 0,
      });

      aiChatRef.current = aiChat;

      // 发送搜索请求
      const result = await aiChat.send(userInput, userInput);

      if (!result.success) {
        message.error(`AI搜索失败: ${result.error}`);
        return;
      }

      const response = result.content.trim();

      // 检查是否找到节点
      if (response === "NOT_FOUND") {
        message.warning("未找到相关节点");
        return;
      }

      // 定位到节点
      focusNodeInCurrentFile(response);
    } catch (error: any) {
      message.error(`AI搜索异常: ${error.message || "未知错误"}`);
    } finally {
      setAiSearching(false);
      aiChatRef.current = null;
    }
  }, [searchValue, buildNodesContext, focusNodeInCurrentFile]);

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
        <Tooltip
          placement="bottom"
          title={aiSearching ? "AI搜索中..." : "AI智能搜索"}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              marginRight: 6,
            }}
          >
            {aiSearching ? (
              <Spin size="small" />
            ) : (
              <IconFont
                className={style["search-icon"]}
                name="icon-AIsousuo"
                size={28}
                color={"#5f50ff"}
                onClick={handleAISearchClick}
              />
            )}
          </div>
        </Tooltip>
        <div className={style.devider}>
          <div></div>
        </div>
        <Tooltip placement="bottom" title="节点列表">
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
