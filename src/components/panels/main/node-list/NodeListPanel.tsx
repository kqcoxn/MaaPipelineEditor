/**
 * 节点列表面板组件
 */

import { memo, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Input, Select, Empty } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { SelectProps } from "antd";
import classNames from "classnames";
import {
  useFlowStore,
  getNodeAbsolutePosition,
  type NodeType,
  type EdgeType,
} from "../../../../stores/flow";
import { NodeTypeEnum } from "../../../flow/nodes/constants";
import NodeListItem from "./NodeListItem";
import {
  type NodeListItemInfo,
  type NodeGroup,
  NODE_TYPE_CONFIG,
} from "./types";
import style from "./NodeListPanel.module.less";

const { Search } = Input;

/** 节点类型选项 */
const NODE_TYPE_OPTIONS: SelectProps["options"] = [
  { value: "all", label: "全部类型" },
  { value: NodeTypeEnum.Pipeline, label: "Pipeline" },
  { value: NodeTypeEnum.External, label: "External" },
  { value: NodeTypeEnum.Anchor, label: "Anchor" },
  { value: NodeTypeEnum.Sticker, label: "Sticker" },
  { value: NodeTypeEnum.Group, label: "Group" },
];

export interface NodeListPanelProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 锚点元素（用于定位） */
  anchorEl?: HTMLElement | null;
}

function NodeListPanel({ visible, onClose, anchorEl }: NodeListPanelProps) {
  // Store
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const instance = useFlowStore((state) => state.instance);

  // 状态
  const [keyword, setKeyword] = useState("");
  const [selectedType, setSelectedType] = useState<NodeTypeEnum | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<NodeTypeEnum>>(
    new Set([
      NodeTypeEnum.Pipeline,
      NodeTypeEnum.External,
      NodeTypeEnum.Anchor,
      NodeTypeEnum.Sticker,
      NodeTypeEnum.Group,
    ]),
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 500 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 过渡动画状态：visible 变 false 时延迟卸载，等动画结束
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }
  }, [visible]);

  const handleTransitionEnd = useCallback(() => {
    if (!visible) {
      setShouldRender(false);
    }
  }, [visible]);

  // 计算面板位置和高度（相对于锚点元素）
  useEffect(() => {
    const updatePosition = () => {
      if (visible && anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        const top = rect.bottom + 4; // 锚点下方 4px
        const left = window.innerWidth - 385; // 右对齐，距离右边 10px 加面板宽度
        // 计算最大高度：窗口高度 - 顶部位置 - 底部边距(为排版工具栏预留 100px)
        const maxHeight = Math.max(200, window.innerHeight - top - 100);
        setPosition({ top, left, maxHeight });
      }
    };

    updatePosition();

    // 监听窗口大小变化
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [visible, anchorEl]);

  // 计算边的连接数
  const edgeCounts = useMemo(() => {
    const counts: Record<string, { in: number; out: number }> = {};

    // 初始化所有节点的计数
    nodes.forEach((node) => {
      counts[node.id] = { in: 0, out: 0 };
    });

    // 统计边的连接数
    edges.forEach((edge: EdgeType) => {
      if (counts[edge.target]) {
        counts[edge.target].in++;
      }
      if (counts[edge.source]) {
        counts[edge.source].out++;
      }
    });

    return counts;
  }, [nodes, edges]);

  // 构建节点列表数据
  const nodeListData = useMemo((): NodeListItemInfo[] => {
    return nodes.map((node: NodeType) => {
      const counts = edgeCounts[node.id] || { in: 0, out: 0 };
      const baseInfo: NodeListItemInfo = {
        id: node.id,
        label: node.data.label,
        nodeType: node.type as NodeTypeEnum,
        inEdgeCount: counts.in,
        outEdgeCount: counts.out,
      };

      // Pipeline 节点额外信息
      if (node.type === NodeTypeEnum.Pipeline) {
        const pipelineNode = node as any;
        baseInfo.recognitionType =
          pipelineNode.data.recognition?.type || "DirectHit";
        baseInfo.actionType = pipelineNode.data.action?.type || "DoNothing";
        baseInfo.recognitionParam = pipelineNode.data.recognition?.param || {};
        baseInfo.actionParam = pipelineNode.data.action?.param || {};
        baseInfo.others = pipelineNode.data.others || {};
        // 提取模板图片路径
        const template = baseInfo.recognitionParam?.template;
        if (template && Array.isArray(template)) {
          baseInfo.templatePaths = template.filter(
            (t: any) => typeof t === "string" && t.trim(),
          );
        }
      }

      return baseInfo;
    });
  }, [nodes, edgeCounts]);

  // 过滤节点列表
  const filteredNodes = useMemo(() => {
    let result = nodeListData;

    // 关键词过滤
    if (keyword.trim()) {
      const lowerKeyword = keyword.toLowerCase();
      result = result.filter(
        (node) =>
          node.label.toLowerCase().includes(lowerKeyword) ||
          node.recognitionType?.toLowerCase().includes(lowerKeyword) ||
          node.actionType?.toLowerCase().includes(lowerKeyword),
      );
    }

    // 类型过滤
    if (selectedType !== "all") {
      result = result.filter((node) => node.nodeType === selectedType);
    }

    return result;
  }, [nodeListData, keyword, selectedType]);

  // 分组节点
  const groupedNodes = useMemo((): NodeGroup[] => {
    const groups: Record<NodeTypeEnum, NodeListItemInfo[]> = {
      [NodeTypeEnum.Pipeline]: [],
      [NodeTypeEnum.External]: [],
      [NodeTypeEnum.Anchor]: [],
      [NodeTypeEnum.Sticker]: [],
      [NodeTypeEnum.Group]: [],
    };

    filteredNodes.forEach((node) => {
      if (groups[node.nodeType]) {
        groups[node.nodeType].push(node);
      }
    });

    return Object.entries(groups)
      .filter(([, nodes]) => nodes.length > 0)
      .map(([type, nodes]) => ({
        type: type as NodeTypeEnum,
        name: NODE_TYPE_CONFIG[type as NodeTypeEnum].name,
        icon: NODE_TYPE_CONFIG[type as NodeTypeEnum].icon,
        nodes,
        count: nodes.length,
      }));
  }, [filteredNodes]);

  // 切换分组展开状态
  const toggleGroup = useCallback((type: NodeTypeEnum) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // 点击节点项
  const handleNodeClick = useCallback(
    (node: NodeListItemInfo) => {
      const targetNode = nodes.find((n: NodeType) => n.id === node.id);
      if (targetNode && instance) {
        // 选中节点
        useFlowStore.getState().updateNodes(
          nodes.map((n: NodeType) => ({
            type: "select" as const,
            id: n.id,
            selected: n.id === targetNode.id,
          })),
        );

        // 聚焦视图
        const { x, y } = getNodeAbsolutePosition(targetNode, nodes);
        const { width = 200, height = 100 } = targetNode.measured || {};
        instance.setCenter(x + width / 2, y + height / 2, {
          duration: 500,
          zoom: 1.5,
        });
      }

      onClose?.();
    },
    [nodes, instance, onClose],
  );

  // 悬停节点项
  const handleNodeHover = useCallback((node: NodeListItemInfo | null) => {
    setHighlightedNodeId(node?.id || null);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // 排除所有 antd 弹出层的点击
      const antdPopups = document.querySelectorAll(
        ".ant-select-dropdown, .ant-dropdown, .ant-picker-dropdown, .ant-cascader-dropdown, .ant-modal-root",
      );
      for (const popup of antdPopups) {
        if (popup.contains(target)) {
          return;
        }
      }

      // 点击面板外部且不是锚点元素时关闭
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        onClose?.();
      }
    };

    if (visible) {
      // 使用 setTimeout 确保在 Select 下拉菜单渲染后再添加事件
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [visible, onClose, anchorEl]);

  // 统计信息
  const statistics = useMemo(() => {
    const total = nodeListData.length;
    const byType: Record<NodeTypeEnum, number> = {
      [NodeTypeEnum.Pipeline]: nodeListData.filter(
        (n) => n.nodeType === NodeTypeEnum.Pipeline,
      ).length,
      [NodeTypeEnum.External]: nodeListData.filter(
        (n) => n.nodeType === NodeTypeEnum.External,
      ).length,
      [NodeTypeEnum.Anchor]: nodeListData.filter(
        (n) => n.nodeType === NodeTypeEnum.Anchor,
      ).length,
      [NodeTypeEnum.Sticker]: nodeListData.filter(
        (n) => n.nodeType === NodeTypeEnum.Sticker,
      ).length,
      [NodeTypeEnum.Group]: nodeListData.filter(
        (n) => n.nodeType === NodeTypeEnum.Group,
      ).length,
    };
    return { total, byType };
  }, [nodeListData]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    if (visible) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [visible, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      ref={panelRef}
      className={classNames(style["node-list-panel"], {
        [style["node-list-panel-hidden"]]: !visible,
      })}
      style={{
        top: position.top,
        left: position.left,
        height: position.maxHeight,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* 头部筛选区域 */}
      <div className={style["node-list-header"]}>
        <Search
          className={style["filter-input"]}
          placeholder="筛选节点..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          size="small"
        />
        <Select
          className={style["type-select"]}
          value={selectedType}
          onChange={(value) => setSelectedType(value)}
          options={NODE_TYPE_OPTIONS}
          size="small"
          style={{ width: 100 }}
        />
      </div>

      {/* 统计信息 */}
      <div className={style["node-list-stats"]}>
        <span className={style["stats-total"]}>
          共 {statistics.total} 个节点
        </span>
        <span className={style["stats-divider"]}>|</span>
        <span className={style["stats-detail"]}>
          P:{statistics.byType[NodeTypeEnum.Pipeline]}
          E:{statistics.byType[NodeTypeEnum.External]}
          A:{statistics.byType[NodeTypeEnum.Anchor]}
        </span>
      </div>

      {/* 节点列表内容 */}
      <div className={style["node-list-content"]}>
        {groupedNodes.length === 0 ? (
          <Empty
            className={style["empty-state"]}
            description={<span className={style["empty-text"]}>暂无节点</span>}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          groupedNodes.map((group) => (
            <div key={group.type} className={style["node-group"]}>
              <div
                className={style["node-group-header"]}
                onClick={() => toggleGroup(group.type)}
              >
                <span className={style["group-icon"]}>{group.icon}</span>
                <span className={style["group-name"]}>{group.name}</span>
                <span className={style["group-count"]}>({group.count})</span>
                <DownOutlined
                  className={classNames(style["group-toggle"], {
                    [style.collapsed]: !expandedGroups.has(group.type),
                  })}
                />
              </div>
              {expandedGroups.has(group.type) && (
                <div className={style["node-group-content"]}>
                  {group.nodes.map((node) => (
                    <NodeListItem
                      key={node.id}
                      node={node}
                      isHighlighted={highlightedNodeId === node.id}
                      onClick={handleNodeClick}
                      onHover={handleNodeHover}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(NodeListPanel);
