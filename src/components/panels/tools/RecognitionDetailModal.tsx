import { memo, useMemo } from "react";
import { Modal, Tag, Descriptions, Image, Empty, Spin } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useDebugStore } from "../../../stores/debugStore";
import type { RecognitionRecord } from "../../../stores/debugStore";
import debugStyle from "../../../styles/DebugPanel.module.less";
import ReactJsonView from "@microlink/react-json-view";

interface RecognitionDetailModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 识别详情模态框
 * 类似 MaaDebugger 的 reco_page
 */
function RecognitionDetailModal({
  open,
  onClose,
}: RecognitionDetailModalProps) {
  const selectedRecoId = useDebugStore((state) => state.selectedRecoId);
  const recognitionRecordsMap = useDebugStore(
    (state) => state.recognitionRecordsMap
  );
  const executionHistory = useDebugStore((state) => state.executionHistory);

  // 获取选中的识别记录（包含 runIndex 等扩展字段）
  const record = useMemo(():
    | (RecognitionRecord & { runIndex?: number })
    | null => {
    if (!selectedRecoId) return null;

    // 先从 recognitionRecordsMap 中查找
    const fromRecords = recognitionRecordsMap.get(selectedRecoId);
    if (fromRecords) return fromRecords;

    // 否则从 executionHistory 中构造
    const historyRecord = executionHistory[selectedRecoId - 1];
    if (historyRecord) {
      return {
        id: selectedRecoId,
        recoId: selectedRecoId,
        name: historyRecord.nodeName,
        displayName: historyRecord.nodeName,
        status:
          historyRecord.status === "running"
            ? "running"
            : historyRecord.status === "completed"
            ? "succeeded"
            : "failed",
        hit: historyRecord.recognition?.success || false,
        timestamp: historyRecord.startTime,
        runIndex: historyRecord.runIndex,
        detail: historyRecord.recognition?.detail
          ? {
              algorithm: historyRecord.recognition.detail.algorithm,
              bestResult:
                historyRecord.recognition.detail.best_result ||
                historyRecord.recognition.detail.detail,
              box: historyRecord.recognition.detail.box,
              drawImages: historyRecord.recognition.detail.draw_images,
              rawDetail: historyRecord.recognition.detail,
            }
          : undefined,
      };
    }

    return null;
  }, [selectedRecoId, recognitionRecordsMap, executionHistory]);

  // 无数据时
  if (!record && open) {
    return (
      <Modal
        title="识别详情"
        open={open}
        onCancel={onClose}
        footer={null}
        width={600}
        className={debugStyle["recognition-detail-modal"]}
      >
        <Empty description="未找到识别记录" />
      </Modal>
    );
  }

  if (!record) return null;

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>识别详情</span>
          <Tag
            icon={
              record.hit ? <CheckCircleOutlined /> : <CloseCircleOutlined />
            }
            color={record.hit ? "success" : "error"}
          >
            {record.hit ? "命中" : "未命中"}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      className={debugStyle["recognition-detail-modal"]}
    >
      {/* 基本信息 */}
      <div className={debugStyle["recognition-detail-section"]}>
        <div className={debugStyle["recognition-detail-section-title"]}>
          基本信息
        </div>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="节点名称">
            {record.displayName || record.name}
          </Descriptions.Item>
          <Descriptions.Item label="识别ID">{record.recoId}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={
                record.status === "succeeded"
                  ? "success"
                  : record.status === "failed"
                  ? "error"
                  : record.status === "running"
                  ? "processing"
                  : "default"
              }
            >
              {record.status === "succeeded"
                ? "成功"
                : record.status === "failed"
                ? "失败"
                : record.status === "running"
                ? "运行中"
                : "等待中"}
            </Tag>
          </Descriptions.Item>
          {record.runIndex && record.runIndex > 1 && (
            <Descriptions.Item label="执行次数">
              #{record.runIndex}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="时间戳">
            {new Date(record.timestamp).toLocaleTimeString()}
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* 算法信息 */}
      {record.detail?.algorithm && (
        <div className={debugStyle["recognition-detail-section"]}>
          <div className={debugStyle["recognition-detail-section-title"]}>
            算法信息
          </div>
          <div className={debugStyle["recognition-detail-field"]}>
            <span className={debugStyle["recognition-detail-label"]}>
              算法类型:
            </span>
            <span className={debugStyle["recognition-detail-value"]}>
              <Tag color="blue">{record.detail.algorithm}</Tag>
            </span>
          </div>
        </div>
      )}

      {/* 识别结果 */}
      {record.detail?.bestResult !== undefined && (
        <div className={debugStyle["recognition-detail-section"]}>
          <div className={debugStyle["recognition-detail-section-title"]}>
            最佳结果
          </div>
          <div className={debugStyle["recognition-detail-json"]}>
            {typeof record.detail.bestResult === "object" ? (
              <ReactJsonView
                src={record.detail.bestResult}
                enableClipboard={false}
                iconStyle="square"
              />
            ) : (
              <pre>{String(record.detail.bestResult)}</pre>
            )}
          </div>
        </div>
      )}

      {/* 识别框 */}
      {record.detail?.box && (
        <div className={debugStyle["recognition-detail-section"]}>
          <div className={debugStyle["recognition-detail-section-title"]}>
            识别框
          </div>
          <Descriptions column={4} size="small">
            <Descriptions.Item label="X">
              {record.detail.box[0]}
            </Descriptions.Item>
            <Descriptions.Item label="Y">
              {record.detail.box[1]}
            </Descriptions.Item>
            <Descriptions.Item label="W">
              {record.detail.box[2]}
            </Descriptions.Item>
            <Descriptions.Item label="H">
              {record.detail.box[3]}
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}

      {/* 绘制图像 */}
      {record.detail?.drawImages && record.detail.drawImages.length > 0 && (
        <div className={debugStyle["recognition-detail-section"]}>
          <div className={debugStyle["recognition-detail-section-title"]}>
            绘制图像
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {record.detail.drawImages.map((img, index) => (
              <Image
                key={index}
                src={
                  img.startsWith("data:") ? img : `data:image/png;base64,${img}`
                }
                alt={`绘制图像 ${index + 1}`}
                className={debugStyle["recognition-detail-image"]}
                style={{ maxHeight: 200 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 原始详情 */}
      {record.detail?.rawDetail && (
        <div className={debugStyle["recognition-detail-section"]}>
          <div className={debugStyle["recognition-detail-section-title"]}>
            原始详情
          </div>
          <div className={debugStyle["recognition-detail-json"]}>
            <ReactJsonView
              src={record.detail.rawDetail}
              enableClipboard={false}
              iconStyle="square"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

export default memo(RecognitionDetailModal);
