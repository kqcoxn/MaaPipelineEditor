import { memo, useMemo, useState, useCallback } from "react";
import {
  Tag,
  Empty,
  Button,
  Pagination,
  Divider,
  Space,
  Tooltip,
  List,
} from "antd";
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useDebugStore } from "../../../stores/debugStore";
import type {
  RecognitionRecord,
  RecognitionStatus,
} from "../../../stores/debugStore";
import debugStyle from "../../../styles/DebugPanel.module.less";
import RecognitionDetailModal from "./RecognitionDetailModal";

/**
 * 每页显示的识别项数量
 */
const PAGE_SIZE = 30;

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
    text: "等待中",
  },
  running: {
    icon: <LoadingOutlined spin />,
    color: "processing",
    text: "识别中",
  },
  succeeded: {
    icon: <CheckCircleOutlined />,
    color: "success",
    text: "成功",
  },
  failed: {
    icon: <CloseCircleOutlined />,
    color: "error",
    text: "失败",
  },
};

/**
 * 识别项组件（平铺结构）
 */
interface RecognitionItemProps {
  record: RecognitionRecord;
  index: number;
  onViewDetail: (recoId: number) => void;
}

const RecognitionItem = memo(function RecognitionItem({
  record,
  index,
  onViewDetail,
}: RecognitionItemProps) {
  const config = statusConfig[record.status];
  const hasDetail = record.recoId > 0 && record.detail;

  return (
    <div className={debugStyle["recognition-item"]}>
      <div className={debugStyle["recognition-item-main"]}>
        <span className={debugStyle["recognition-item-index"]}>[{index}]</span>
        <span className={debugStyle["recognition-item-name"]}>
          {record.displayName || record.name}
        </span>
        <Tag
          icon={config.icon}
          color={config.color}
          className={debugStyle["recognition-item-status"]}
        >
          {config.text}
        </Tag>
        {record.hit && (
          <Tag color="green" className={debugStyle["recognition-item-hit"]}>
            命中
          </Tag>
        )}
      </div>
      <div className={debugStyle["recognition-item-actions"]}>
        {hasDetail && (
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewDetail(record.recoId)}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
});

/**
 * 识别结果列表 Tab 属性
 */
interface RecognitionListTabProps {
  /** 当前选中的节点名称，用于过滤只显示该节点的识别记录（可选） */
  nodeName?: string;
}

/**
 * 识别结果列表 Tab（平铺结构）
 * 每次 recognition_starting 创建一条新记录
 * 记录主体是被识别的节点名
 * 如果不传 nodeName，则显示所有识别记录（平铺）
 */
function RecognitionListTab({ nodeName }: RecognitionListTabProps = {}) {
  // 使用新的平铺结构
  const allRecognitionRecords = useDebugStore(
    (state) => state.recognitionRecords
  );
  const debugStatus = useDebugStore((state) => state.debugStatus);
  const clearRecognitionRecords = useDebugStore(
    (state) => state.clearRecognitionRecords
  );
  const setSelectedRecoId = useDebugStore((state) => state.setSelectedRecoId);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [reversed, setReversed] = useState(true); // 默认倒序（最新在前）

  // 详情模态框状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 过滤后的记录（显示被识别为当前节点的记录）
  // 记录的 name 是被识别的目标节点，这才是记录的主体
  // 应该根据 name 过滤，显示所有「被识别为该节点」的记录
  const recognitionRecords = useMemo(() => {
    if (!nodeName) return allRecognitionRecords;
    return allRecognitionRecords.filter((record) => record.name === nodeName);
  }, [allRecognitionRecords, nodeName]);

  // 处理后的记录数据（平铺）
  const displayRecords = useMemo(() => {
    return reversed ? [...recognitionRecords].reverse() : recognitionRecords;
  }, [recognitionRecords, reversed]);

  // 分页后的记录
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return displayRecords.slice(startIndex, endIndex);
  }, [displayRecords, currentPage]);

  // 总记录数
  const totalRecords = recognitionRecords.length;

  // 计算序号（考虑分页和排序）
  const getDisplayIndex = useCallback(
    (pageIndex: number) => {
      if (reversed) {
        return totalRecords - (currentPage - 1) * PAGE_SIZE - pageIndex;
      } else {
        return (currentPage - 1) * PAGE_SIZE + pageIndex + 1;
      }
    },
    [reversed, currentPage, totalRecords]
  );

  // 查看详情
  const handleViewDetail = useCallback(
    (recoId: number) => {
      setSelectedRecoId(recoId);
      setDetailModalOpen(true);
    },
    [setSelectedRecoId]
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

  // 切换反转
  const handleToggleReverse = useCallback(() => {
    setReversed((prev) => !prev);
  }, []);

  // 无数据时的提示
  if (totalRecords === 0) {
    return (
      <div className={debugStyle["recognition-list-empty"]}>
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
    <div className={debugStyle["recognition-list-container"]}>
      {/* 工具栏 */}
      <div className={debugStyle["recognition-list-toolbar"]}>
        <Space>
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
            disabled={totalRecords === 0}
          >
            清空
          </Button>
          <Button size="small" onClick={handleToggleReverse}>
            {reversed ? "正序" : "倒序"}
          </Button>
        </Space>
        <span className={debugStyle["recognition-list-count"]}>
          共 {totalRecords} 项
        </span>
      </div>

      <Divider style={{ margin: "8px 0" }} />

      {/* 识别记录列表（平铺） */}
      <div className={debugStyle["recognition-list-content"]}>
        <List
          size="small"
          split={false}
          dataSource={paginatedRecords}
          renderItem={(record, index) => (
            <RecognitionItem
              key={record.id}
              record={record}
              index={getDisplayIndex(index)}
              onViewDetail={handleViewDetail}
            />
          )}
        />
      </div>

      {/* 分页 */}
      {totalRecords > PAGE_SIZE && (
        <div className={debugStyle["recognition-list-pagination"]}>
          <Pagination
            size="small"
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={totalRecords}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            showQuickJumper={totalRecords > PAGE_SIZE * 3}
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

export default memo(RecognitionListTab);
