import style from "../../../styles/ToolPanel.module.less";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { message, Tooltip, AutoComplete, Spin } from "antd";
import type { AutoCompleteProps } from "antd";
import classNames from "classnames";
import { useDebounceFn } from "ahooks";
import IconFont from "../../iconfonts";
import { useFlowStore, type NodeType } from "../../../stores/flow";
import { OpenAIChat } from "../../../utils/openai";
import { NodeTypeEnum } from "../../flow/nodes";

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
  const [aiSearching, setAiSearching] = useState(false);
  const searchRef = useRef<any>(null);
  const aiChatRef = useRef<OpenAIChat | null>(null);

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
      const systemPrompt = `你是一个节点搜索助手。用户会给你一个节点列表和搜索需求，你需要找到最匹配的节点。

重要规则：
1. 仅返回最匹配的节点名称（label字段的值），不要有任何其他说明文字
2. 如果没有任何相关节点，返回：NOT_FOUND
3. 节点类型说明：pipeline=流程节点，external=外部节点，anchor=锚点节点
4. 对于pipeline节点：
   - recognition 是识别方式，包含 type（识别类型）和 param（具体参数）
   - action 是动作方式，包含 type（动作类型）和 param（具体参数）
   - others 是其他配置参数
5. 识别常见字段：template（模板图片）、threshold（阈值）、roi（识别区域）、expected（期望文本）等
6. 动作常见字段：target（目标位置）、input_text（输入文本）、package（应用包名）等
7. 根据用户描述，从节点的识别内容、动作内容、配置参数等维度综合判断最匹配的节点

节点列表：
${JSON.stringify(nodesContext, null, 2)}`;

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
      focusNode(response);
    } catch (error: any) {
      message.error(`AI搜索异常: ${error.message || "未知错误"}`);
    } finally {
      setAiSearching(false);
      aiChatRef.current = null;
    }
  }, [searchValue, buildNodesContext, focusNode]);

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
      </div>
    </div>
  );
}

export default memo(SearchPanel);
