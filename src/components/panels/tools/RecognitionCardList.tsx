import { memo, useMemo, useState, useCallback } from "react";
import { Card, Tag, Empty, Button, Pagination, Space, Tooltip } from "antd";
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useDebugStore } from "../../../stores/debugStore";
import type { RecognitionStatus } from "../../../stores/debugStore";
import debugStyle from "../../../styles/panels/DebugPanel.module.less";
import RecognitionDetailModal from "./RecognitionDetailModal";

/**
 * 每页显示的卡片数量
 */
const PAGE_SIZE = 10;

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
 * 每次 next_list 创建
 */
interface RecognitionCardData {
  id: number;
  currentNode: string; // 当前运行的节点（卡片标题）
  currentNodeId?: string; // 当前节点的 ID
  items: CardItem[]; // next/on_error 列表中的节点
  timestamp: number;
}

/**
 * 单个识别项组件
 */
interface RecognitionItemProps {
  item: CardItem;
  index: number;
  onViewDetail: (recoId: number) => void;
}

const RecognitionItem = memo(function RecognitionItem({
  item,
  index,
  onViewDetail,
}: RecognitionItemProps) {
  const config = statusConfig[item.status];
  const hasDetail = item.recoId > 0;

  return (
    <div className={debugStyle["reco-card-item"]}>
      <span className={debugStyle["reco-card-item-index"]}>[{index + 1}]</span>
      <span className={debugStyle["reco-card-item-status"]}>{config.text}</span>
      <span className={debugStyle["reco-card-item-name"]}>
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
interface RecognitionCardProps {
  card: RecognitionCardData;
  index: number;
  onViewDetail: (recoId: number) => void;
}

const RecognitionCard = memo(function RecognitionCard({
  card,
  index,
  onViewDetail,
}: RecognitionCardProps) {
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
            />
          ))}
        </div>
      )}
    </Card>
  );
});

/**
 * 识别卡片列表组件
 * 每次 next_list 事件创建一个卡片，卡片标题是当前运行的节点，
 * 卡片内容是 next/on_error 列表中的节点
 */
function RecognitionCardList() {
  const recognitionRecords = useDebugStore((state) => state.recognitionRecords);
  const debugStatus = useDebugStore((state) => state.debugStatus);
  const clearRecognitionRecords = useDebugStore(
    (state) => state.clearRecognitionRecords,
  );
  const setSelectedRecoId = useDebugStore((state) => state.setSelectedRecoId);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 详情模态框状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 将平铺的 recognitionRecords 转换为卡片结构
  // 每个卡片代表一轮 next 识别：当 parentNode 变化时创建新卡片
  // 卡片标题 = parentNode（发起识别的节点）
  // 卡片内容 = 该 parentNode 下的所有识别项（next 列表）
  const cards = useMemo((): RecognitionCardData[] => {
    const result: RecognitionCardData[] = [];
    let currentCard: RecognitionCardData | null = null;
    let cardId = 0;

    recognitionRecords.forEach((record) => {
      const parentNodeName = record.parentNode || "未知节点";

      // 当 parentNode 变化时，创建新卡片（代表新一轮 next 识别）
      if (!currentCard || currentCard.currentNode !== parentNodeName) {
        // 保存前一个卡片
        if (currentCard) {
          result.push(currentCard);
        }

        // 创建新卡片
        cardId++;
        currentCard = {
          id: cardId,
          currentNode: parentNodeName, // 卡片标题 = 发起识别的节点
          items: [],
          timestamp: record.timestamp,
        };
      }

      // 添加识别项到当前卡片（next 列表中的一个节点）
      currentCard.items.push({
        name: record.name,
        displayName: record.displayName,
        status: record.status,
        recoId: record.recoId,
        hit: record.hit,
      });

      // 更新卡片时间戳为最新记录的时间
      currentCard.timestamp = record.timestamp;
    });

    // 添加最后一个卡片
    if (currentCard) {
      result.push(currentCard);
    }

    return result;
  }, [recognitionRecords]);

  // 倒序显示（最新的在前面）
  const displayCards = useMemo(() => {
    return [...cards].reverse();
  }, [cards]);

  // 分页后的卡片
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return displayCards.slice(startIndex, endIndex);
  }, [displayCards, currentPage]);

  // 总卡片数
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

  // 清空记录
  const handleClear = useCallback(() => {
    clearRecognitionRecords();
    setCurrentPage(1);
  }, [clearRecognitionRecords]);

  // 无数据时的提示
  if (totalCards === 0) {
    return (
      <div className={debugStyle["reco-card-list-empty"]}>
        <Empty
          description={
            debugStatus === "idle"
              ? "暂无识别记录，请先启动调试"
              : "正在等待识别结果..."
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className={debugStyle["reco-card-list-container"]}>
      {/* 工具栏 */}
      <div className={debugStyle["reco-card-list-toolbar"]}>
        <Space>
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
            disabled={totalCards === 0}
          >
            清空
          </Button>
        </Space>
        <span className={debugStyle["reco-card-list-count"]}>
          共 {totalCards} 轮识别
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

export default memo(RecognitionCardList);
