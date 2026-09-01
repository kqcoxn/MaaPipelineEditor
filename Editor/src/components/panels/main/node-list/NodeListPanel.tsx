import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input, Select, Empty } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { SelectProps } from "antd";
import classNames from "classnames";
import {
  useFlowStore,
  type NodeType,
  type EdgeType,
} from "../../../../stores/flow";
import { selectAndCenterNode } from "../../../../services/flowNavigationService";
import { VirtualList } from "../../../common/VirtualList";
import { NodeTypeEnum } from "../../../flow/nodes/constants";
import { WikiAnchor } from "../../../wiki/WikiAnchor";
import NodeListItem from "./NodeListItem";
import { NodePreviewPopover } from "./NodePreviewPopover";
import {
  buildNodeListData,
  buildNodeListRows,
  calculateNodeListStatistics,
  filterNodeListData,
  groupNodeListData,
} from "./nodeListModel";
import type { NodeListItemInfo, NodeListRow } from "./types";
import style from "./NodeListPanel.module.less";

const { Search } = Input;
const EMPTY_NODES: NodeType[] = [];
const EMPTY_EDGES: EdgeType[] = [];
const NODE_LIST_ROW_HEIGHT = 40;
const NODE_LIST_FIXED_CONTENT_HEIGHT = 69;
const PREVIEW_OPEN_DELAY_MS = 300;

const NODE_TYPE_OPTIONS: SelectProps["options"] = [
  { value: "all", label: "全部类型" },
  { value: NodeTypeEnum.Pipeline, label: "Pipeline" },
  { value: NodeTypeEnum.External, label: "External" },
  { value: NodeTypeEnum.Anchor, label: "Anchor" },
  { value: NodeTypeEnum.Sticker, label: "Sticker" },
  { value: NodeTypeEnum.Group, label: "Group" },
];

const DEFAULT_EXPANDED_GROUPS = new Set([
  NodeTypeEnum.Pipeline,
  NodeTypeEnum.External,
  NodeTypeEnum.Anchor,
  NodeTypeEnum.Sticker,
  NodeTypeEnum.Group,
]);

export interface NodeListPanelProps {
  visible: boolean;
  onClose?: () => void;
  anchorEl?: HTMLElement | null;
}

function NodeListPanel({ visible, onClose, anchorEl }: NodeListPanelProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const nodes = useFlowStore((state) =>
    shouldRender ? state.nodes : EMPTY_NODES,
  );
  const edges = useFlowStore((state) =>
    shouldRender ? state.edges : EMPTY_EDGES,
  );

  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [selectedType, setSelectedType] = useState<NodeTypeEnum | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(DEFAULT_EXPANDED_GROUPS),
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 500 });
  const panelRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) setShouldRender(true);
  }, [visible]);

  useEffect(
    () => () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    },
    [],
  );

  const handleTransitionEnd = useCallback(() => {
    if (!visible) setShouldRender(false);
  }, [visible]);

  useEffect(() => {
    const updatePosition = () => {
      if (!visible || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const top = rect.bottom + 4;
      const left = window.innerWidth - 385;
      const maxHeight = Math.max(200, window.innerHeight - top - 100);
      setPosition({ top, left, maxHeight });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [visible, anchorEl]);

  const nodeListData = useMemo(
    () => buildNodeListData(nodes, edges),
    [nodes, edges],
  );
  const filteredNodes = useMemo(
    () => filterNodeListData(nodeListData, deferredKeyword, selectedType),
    [nodeListData, deferredKeyword, selectedType],
  );
  const groupedNodes = useMemo(
    () => groupNodeListData(filteredNodes),
    [filteredNodes],
  );
  const rows = useMemo(
    () => buildNodeListRows(groupedNodes, expandedGroups),
    [groupedNodes, expandedGroups],
  );
  const statistics = useMemo(
    () => calculateNodeListStatistics(nodeListData),
    [nodeListData],
  );

  const toggleGroup = useCallback((type: NodeTypeEnum) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setPreviewNodeId(null);
  }, []);

  const handleNodeClick = useCallback(
    (item: NodeListItemInfo) => {
      selectAndCenterNode(item.id);
      onClose?.();
    },
    [onClose],
  );

  const handleNodeHover = useCallback((node: NodeListItemInfo | null) => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setHighlightedNodeId(node?.id ?? null);
    if (!node) return;
    setPreviewNodeId((current) => (current === node.id ? current : null));
    previewTimerRef.current = setTimeout(() => {
      setPreviewNodeId(node.id);
      previewTimerRef.current = null;
    }, PREVIEW_OPEN_DELAY_MS);
  }, []);

  const handlePreviewOpenChange = useCallback((nodeId: string, open: boolean) => {
    if (!open) {
      setPreviewNodeId((current) => (current === nodeId ? null : current));
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const popups = document.querySelectorAll(
        ".ant-select-dropdown, .ant-dropdown, .ant-picker-dropdown, .ant-cascader-dropdown, .ant-modal-root",
      );
      for (const popup of popups) {
        if (popup.contains(target)) return;
      }
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        onClose?.();
      }
    };

    if (!visible) return;
    const timer = setTimeout(
      () => document.addEventListener("mousedown", handleClickOutside),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visible, onClose, anchorEl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    if (!visible) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  const renderRow = useCallback(
    (row: NodeListRow) => {
      if (row.kind === "group") {
        const expanded = expandedGroups.has(row.group.type);
        const toggle = () => toggleGroup(row.group.type);
        return (
          <div
            className={style["node-group-header"]}
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={toggle}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
              }
            }}
          >
            <span className={style["group-icon"]}>{row.group.icon}</span>
            <span className={style["group-name"]}>{row.group.name}</span>
            <span className={style["group-count"]}>({row.group.count})</span>
            <DownOutlined
              className={classNames(style["group-toggle"], {
                [style.collapsed]: !expanded,
              })}
            />
          </div>
        );
      }

      const item = (
        <NodeListItem
          node={row.node}
          isHighlighted={highlightedNodeId === row.node.id}
          onClick={handleNodeClick}
          onHover={handleNodeHover}
        />
      );
      return previewNodeId === row.node.id ? (
        <NodePreviewPopover
          node={row.node}
          open
          onOpenChange={(open) => handlePreviewOpenChange(row.node.id, open)}
        >
          {item}
        </NodePreviewPopover>
      ) : (
        item
      );
    },
    [
      expandedGroups,
      handleNodeClick,
      handleNodeHover,
      handlePreviewOpenChange,
      highlightedNodeId,
      previewNodeId,
      toggleGroup,
    ],
  );

  const handleVisibleRowsChange = useCallback(
    (visibleRows: NodeListRow[]) => {
      if (
        previewNodeId &&
        !visibleRows.some(
          (row) => row.kind === "node" && row.node.id === previewNodeId,
        )
      ) {
        setPreviewNodeId(null);
      }
    },
    [previewNodeId],
  );

  if (!shouldRender) return null;

  const listHeight = Math.max(1, position.maxHeight - NODE_LIST_FIXED_CONTENT_HEIGHT);
  return (
    <div
      ref={panelRef}
      className={classNames(style["node-list-panel"], {
        [style["node-list-panel-hidden"]]: !visible,
      })}
      style={{ top: position.top, left: position.left, height: position.maxHeight }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className={style["node-list-header"]}>
        <Search
          className={style["filter-input"]}
          placeholder="筛选节点..."
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          allowClear
          size="small"
        />
        <Select
          className={style["type-select"]}
          value={selectedType}
          onChange={setSelectedType}
          options={NODE_TYPE_OPTIONS}
          size="small"
          style={{ width: 100 }}
        />
        <WikiAnchor
          path="10.工作流面板/20.节点.html"
          title="节点"
          description="节点类型与属性详解"
        />
      </div>

      <div className={style["node-list-stats"]}>
        <span className={style["stats-total"]}>共 {statistics.total} 个节点</span>
        <span className={style["stats-divider"]}>|</span>
        <span className={style["stats-detail"]}>
          P:{statistics.byType[NodeTypeEnum.Pipeline]}
          E:{statistics.byType[NodeTypeEnum.External]}
          A:{statistics.byType[NodeTypeEnum.Anchor]}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className={style["node-list-content"]}>
          <Empty
            className={style["empty-state"]}
            description={<span className={style["empty-text"]}>暂无节点</span>}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <VirtualList
          ariaLabel={`节点列表，共 ${filteredNodes.length} 个节点`}
          className={style["node-list-content"]}
          estimatedItemHeight={NODE_LIST_ROW_HEIGHT}
          height={listHeight}
          itemKey={(row) => row.key}
          items={rows}
          onVisibleItemsChange={handleVisibleRowsChange}
          renderItem={renderRow}
        />
      )}
    </div>
  );
}

export default memo(NodeListPanel);
