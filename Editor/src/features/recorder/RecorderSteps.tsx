import { Button } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useRecorderStore } from "./store";
import styles from "./Recorder.module.less";

export function RecorderSteps() {
  const steps = useRecorderStore((s) => s.steps);
  const current = useRecorderStore((s) => s.current);
  const detailsOpen = useRecorderStore((s) => s.detailsOpen);
  const busy = useRecorderStore((s) => s.busy);
  return (
    <aside className={styles.steps} aria-label="已保存步骤">
      <div className={styles.sectionHeading}>
        <h3>已保存步骤 <span className={styles.count}>{steps.length}</span></h3>
      </div>
      <div className={styles.stepList}>
        {!steps.length && (
          <p className={styles.emptySteps}>
            开始录制后，在右侧画面直接操作。点击会自动留下步骤与模板候选，无需逐步保存。
          </p>
        )}
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`${styles.step} ${detailsOpen && step.id === current.id ? styles.selected : ""}`}
          >
            <button
              aria-current={detailsOpen && step.id === current.id ? "step" : undefined}
              title={step.suggestionError}
              className={styles.stepSelect}
              disabled={busy}
              onClick={() => {

                useRecorderStore.getState().select(step.id);
              }}
            >
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.stepContent}>
                {step.config.templateImage && (
                  <img
                    src={step.config.templateImage}
                    alt="点击附近模板候选"
                    className={styles.captureThumb}
                  />
                )}
                <strong title={step.config.name}>
                  {step.config.name}
                </strong>
                <span className={styles.stepStatus}>
                  {step.capture && step.capture.status !== "success" && (
                    <span>
                      {step.capture.status === "pending"
                        ? "点击发送中"
                        : step.capture.status === "failed"
                          ? "点击失败"
                          : step.capture.status === "unknown"
                            ? "点击结果不明"
                            : "已操作设备"}{" "}
                      ·{" "}
                    </span>
                  )}
                  {step.suggestion === "pending"
                    ? "文字分析中 · "
                    : step.suggestion === "unavailable"
                      ? "OCR 不可用 · "
                      : ""}
                  已记录
                </span>
              </span>
            </button>
            <div className={styles.stepTools}>
              <Button
                size="small"
                type="text"
                danger
                aria-label={`删除步骤 ${index + 1}`}
                icon={<DeleteOutlined />}
                disabled={busy}
                onClick={() =>
                  useRecorderStore.getState().remove(step.id)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
