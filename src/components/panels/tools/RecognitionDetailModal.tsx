import { memo, useMemo } from "react";
import { Modal, Tag, Descriptions, Image, Empty } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useDebugStore } from "../../../stores/debugStore";
import type {
  RecognitionRecord,
  RecognitionDetail,
} from "../../../stores/debugStore";
import debugStyle from "../../../styles/DebugPanel.module.less";
import ReactJsonView from "@microlink/react-json-view";

interface RecognitionDetailModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 识别详情模态框
 * 类似 MaaDebugger 的 reco_page
 * 显示识别记录的基本信息和缓存的详情
 */
function RecognitionDetailModal({
  open,
  onClose,
}: RecognitionDetailModalProps) {
  const selectedRecoId = useDebugStore((state) => state.selectedRecoId);
  const recognitionRecords = useDebugStore((state) => state.recognitionRecords);
  const detailCache = useDebugStore((state) => state.detailCache);
  const getRecognitionRecord = useDebugStore(
    (state) => state.getRecognitionRecord
  );
  const getCachedDetail = useDebugStore((state) => state.getCachedDetail);

  // 获取选中的识别记录
  const record = useMemo((): RecognitionRecord | null => {
    if (!selectedRecoId) return null;
    return getRecognitionRecord(selectedRecoId) || null;
  }, [selectedRecoId, recognitionRecords, getRecognitionRecord]);

  // 获取缓存的详情
  const detail = useMemo((): RecognitionDetail | undefined => {
    if (!selectedRecoId) return undefined;
    return getCachedDetail(selectedRecoId);
  }, [selectedRecoId, detailCache, getCachedDetail]);

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
          {record.parentNode && (
            <Descriptions.Item label="父节点">
              {record.parentNode}
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>

      {/* 详情内容（如果有缓存） */}
      {detail && (
        <>
          {/* 算法信息 */}
          {detail.algorithm && (
            <div className={debugStyle["recognition-detail-section"]}>
              <div className={debugStyle["recognition-detail-section-title"]}>
                算法信息
              </div>
              <div className={debugStyle["recognition-detail-field"]}>
                <span className={debugStyle["recognition-detail-label"]}>
                  算法类型:
                </span>
                <span className={debugStyle["recognition-detail-value"]}>
                  <Tag color="blue">{detail.algorithm}</Tag>
                </span>
              </div>
            </div>
          )}

          {/* 绘制图像 */}
          {detail.drawImages && detail.drawImages.length > 0 && (
            <div className={debugStyle["recognition-detail-section"]}>
              <div className={debugStyle["recognition-detail-section-title"]}>
                绘制图像
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {detail.drawImages.map((img, index) => (
                  <Image
                    key={index}
                    src={
                      img.startsWith("data:")
                        ? img
                        : `data:image/png;base64,${img}`
                    }
                    alt={`绘制图像 ${index + 1}`}
                    className={debugStyle["recognition-detail-image"]}
                    style={{ maxHeight: 200 }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 最佳结果 */}
          {detail.bestResult !== undefined && (
            <div className={debugStyle["recognition-detail-section"]}>
              <div className={debugStyle["recognition-detail-section-title"]}>
                最佳结果
              </div>
              <div className={debugStyle["recognition-detail-json"]}>
                {typeof detail.bestResult === "object" ? (
                  <ReactJsonView
                    src={detail.bestResult}
                    enableClipboard={false}
                    iconStyle="square"
                  />
                ) : (
                  <pre>{String(detail.bestResult)}</pre>
                )}
              </div>
            </div>
          )}

          {/* 识别框 */}
          {detail.box && (
            <div className={debugStyle["recognition-detail-section"]}>
              <div className={debugStyle["recognition-detail-section-title"]}>
                识别框
              </div>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="X">{detail.box[0]}</Descriptions.Item>
                <Descriptions.Item label="Y">{detail.box[1]}</Descriptions.Item>
                <Descriptions.Item label="W">{detail.box[2]}</Descriptions.Item>
                <Descriptions.Item label="H">{detail.box[3]}</Descriptions.Item>
              </Descriptions>
            </div>
          )}

          {/* 原始详情 */}
          {detail.rawDetail && (
            <div className={debugStyle["recognition-detail-section"]}>
              <div className={debugStyle["recognition-detail-section-title"]}>
                原始详情
              </div>
              <div className={debugStyle["recognition-detail-json"]}>
                <ReactJsonView
                  src={detail.rawDetail}
                  enableClipboard={false}
                  iconStyle="square"
                />
              </div>
            </div>
          )}

          {/* 原始图像 */}
          {detail.rawImage && (
            <div className={debugStyle["recognition-detail-section"]}>
              <div className={debugStyle["recognition-detail-section-title"]}>
                原始图像
              </div>
              <div>
                <Image
                  src={
                    detail.rawImage.startsWith("data:")
                      ? detail.rawImage
                      : `data:image/png;base64,${detail.rawImage}`
                  }
                  alt="原始图像"
                  className={debugStyle["recognition-detail-image"]}
                  style={{ maxHeight: 300 }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* 无详情缓存时的提示 */}
      {!detail && (
        <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
          详细信息尚未加载（后端事件中包含详情时将自动显示）
        </div>
      )}
    </Modal>
  );
}

export default memo(RecognitionDetailModal);
