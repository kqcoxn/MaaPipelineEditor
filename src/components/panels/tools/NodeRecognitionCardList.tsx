/**
 * 节点识别卡片列表组件
 *
 * 支持两种过滤模式：
 * 1. "source" - 出发节点记录：过滤 parentNode === 当前节点名 的卡片
 * 2. "target" - 目标节点记录：过滤卡片中 items 包含当前节点名 的记录
 */

import { memo, useMemo, useState, useCallback } from "react";
import { Card, Tag, Empty, Button, Pagination, Space, Tooltip } from "antd";
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useDebugStore } from "../../../stores/debugStore";
import type { RecognitionStatus } from "../../../stores/debugStore";
import debugStyle from "../../../styles/panels/DebugPanel.module.less";
import RecognitionDetailModal from "./RecognitionDetailModal";

/**
 * 每页显示的卡片数量
 */
const PAGE_SIZE = 5;

/**
 * 状态对应的图标和颜色
 */
const statusConfig: Record<
  RecognitionStatus,
  { icon: React.ReactNode; color: string; text: string }
> = {
  pending: {
    icon: <ClockCircleOutlined />,
    color: "default",
    text: "🟡",
  },
  running: {
    icon: <LoadingOutlined spin />,
    color: "processing",
    text: "👀",
  },
  succeeded: {
    icon: <CheckCircleOutlined />,
    color: "success",
    text: "✅",
  },
  failed: {
    icon: <CloseCircleOutlined />,
    color: "error",
    text: "❌",
  },
};

/**
 * 识别卡片项接口
 */
interface CardItem {
  name: string;
  displayName?: string;
  status: RecognitionStatus;
  recoId: number;
  hit: boolean;
}

/**
 * 识别卡片接口
 */
interface RecognitionCardData {
  id: number;
  currentNode: string;
  items: CardItem[];
  timestamp: number;
}

/**
 * 单个识别项组件
 */
const RecognitionItem = memo(function RecognitionItem({
  item,
  index,
  onViewDetail,
  highlight,
}: {
  item: CardItem;
  index: number;
  onViewDetail: (recoId: number) => void;
  highlight?: boolean;
}) {
  const config = statusConfig[item.status];
  const hasDetail = item.recoId > 0;

  return (
    <div
      className={debugStyle["reco-card-item"]}
      style={highlight ? { backgroundColor: "rgba(22, 119, 255, 0.1)" } : {}}
    >
      <span className={debugStyle["reco-card-item-index"]}>[{index + 1}]</span>
      <span className={debugStyle["reco-card-item-status"]}>{config.text}</span>
      <span
        className={debugStyle["reco-card-item-name"]}
        style={highlight ? { fontWeight: 600, color: "#1677ff" } : {}}
      >
        {item.displayName || item.name}
      </span>
      {item.hit && (
        <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>
          命中
        </Tag>
      )}
      {hasDetail && (
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            className={debugStyle["reco-card-item-action"]}
            onClick={() => onViewDetail(item.recoId)}
          />
        </Tooltip>
      )}
    </div>
  );
});

/**
 * 单个卡片组件
 */
const RecognitionCard = memo(function RecognitionCard({
  card,
  index,
  onViewDetail,
  highlightNodeName,
}: {
  card: RecognitionCardData;
  index: number;
  onViewDetail: (recoId: number) => void;
  highlightNodeName?: string;
}) {
  return (
    <Card
      size="small"
      className={debugStyle["reco-card"]}
      title={
        <div className={debugStyle["reco-card-title"]}>
          <span className={debugStyle["reco-card-index"]}>#{index + 1}</span>
          <span className={debugStyle["reco-card-node"]}>
            {card.currentNode}
          </span>
        </div>
      }
      extra={
        <span className={debugStyle["reco-card-time"]}>
          {new Date(card.timestamp).toLocaleTimeString()}
        </span>
      }
    >
      {card.items.length === 0 ? (
        <div className={debugStyle["reco-card-empty"]}>无待识别节点</div>
      ) : (
        <div className={debugStyle["reco-card-items"]}>
          {card.items.map((item, idx) => (
            <RecognitionItem
              key={`${item.name}-${idx}`}
              item={item}
              index={idx}
              onViewDetail={onViewDetail}
              highlight={
                highlightNodeName
                  ? item.name === highlightNodeName ||
                    item.displayName === highlightNodeName
                  : false
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
});

/**
 * 组件属性
 */
interface NodeRecognitionCardListProps {
  /** 当前节点名称 */
  nodeName: string;
  /** 过滤模式: "source" = 出发节点记录, "target" = 目标节点记录 */
  filterMode: "source" | "target";
}

/**
 * 节点识别卡片列表组件
 */
function NodeRecognitionCardList({
  nodeName,
  filterMode,
}: NodeRecognitionCardListProps) {
  const recognitionRecords = useDebugStore((state) => state.recognitionRecords);
  const debugStatus = useDebugStore((state) => state.debugStatus);
  const setSelectedRecoId = useDebugStore((state) => state.setSelectedRecoId);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 详情模态框状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 将平铺的 recognitionRecords 转换为卡片结构，并根据模式过滤
  const cards = useMemo((): RecognitionCardData[] => {
    // 先生成所有卡片
    const allCards: RecognitionCardData[] = [];
    let currentCard: RecognitionCardData | null = null;
    let cardId = 0;

    recognitionRecords.forEach((record) => {
      const parentNodeName = record.parentNode || "未知节点";

      if (!currentCard || currentCard.currentNode !== parentNodeName) {
        if (currentCard) {
          allCards.push(currentCard);
        }

        cardId++;
        currentCard = {
          id: cardId,
          currentNode: parentNodeName,
          items: [],
          timestamp: record.timestamp,
        };
      }

      currentCard.items.push({
        name: record.name,
        displayName: record.displayName,
        status: record.status,
        recoId: record.recoId,
        hit: record.hit,
      });

      currentCard.timestamp = record.timestamp;
    });

    if (currentCard) {
      allCards.push(currentCard);
    }

    // 根据过滤模式筛选
    if (filterMode === "source") {
      // 出发节点记录：parentNode === nodeName
      return allCards.filter((card) => card.currentNode === nodeName);
    } else {
      // 目标节点记录：items 中包含 nodeName
      return allCards.filter((card) =>
        card.items.some(
          (item) => item.name === nodeName || item.displayName === nodeName,
        ),
      );
    }
  }, [recognitionRecords, nodeName, filterMode]);

  // 倒序显示
  const displayCards = useMemo(() => {
    return [...cards].reverse();
  }, [cards]);

  // 分页后的卡片
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return displayCards.slice(startIndex, endIndex);
  }, [displayCards, currentPage]);

  const totalCards = cards.length;

  // 查看详情
  const handleViewDetail = useCallback(
    (recoId: number) => {
      setSelectedRecoId(recoId);
      setDetailModalOpen(true);
    },
    [setSelectedRecoId],
  );

  // 关闭详情模态框
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedRecoId(null);
  }, [setSelectedRecoId]);

  // 无数据时的提示
  if (totalCards === 0) {
    const emptyText =
      filterMode === "source"
        ? `"${nodeName}" 暂无出发识别记录`
        : `"${nodeName}" 暂未被识别`;

    return (
      <div className={debugStyle["reco-card-list-empty"]}>
        <Empty
          description={
            debugStatus === "idle" ? "暂无识别记录，请先启动调试" : emptyText
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className={debugStyle["reco-card-list-container"]}>
      {/* 统计信息 */}
      <div className={debugStyle["reco-card-list-toolbar"]}>
        <span className={debugStyle["reco-card-list-count"]}>
          共 {totalCards} 条记录
        </span>
      </div>

      {/* 卡片列表 */}
      <div className={debugStyle["reco-card-list-content"]}>
        {paginatedCards.map((card, index) => (
          <RecognitionCard
            key={card.id}
            card={card}
            index={totalCards - (currentPage - 1) * PAGE_SIZE - index - 1}
            onViewDetail={handleViewDetail}
            highlightNodeName={filterMode === "target" ? nodeName : undefined}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalCards > PAGE_SIZE && (
        <div className={debugStyle["reco-card-list-pagination"]}>
          <Pagination
            size="small"
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={totalCards}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            showQuickJumper={totalCards > PAGE_SIZE * 3}
          />
        </div>
      )}

      {/* 详情模态框 */}
      <RecognitionDetailModal
        open={detailModalOpen}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
}

export default memo(NodeRecognitionCardList);
