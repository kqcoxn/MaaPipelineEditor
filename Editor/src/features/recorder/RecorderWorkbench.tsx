import { useState, type CSSProperties } from "react";
import { Modal, Button, Select, Tag, theme } from "antd";
import {
  PlusOutlined,
  UpOutlined,
  DownOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useRecorderStore } from "./store";
import { RecorderCanvas } from "./RecorderCanvas";
import { RecorderFields } from "./RecorderFields";
import { useRecorderLive } from "./useRecorderLive";
import { useRecorderActions } from "./useRecorderActions";
import styles from "./Recorder.module.less";

export default function RecorderWorkbench() {
  const recording = useRecorderStore((s) => s.recording);
  const detailsOpen = useRecorderStore((s) => s.detailsOpen);
  const liveController = useRecorderStore((s) => s.liveFrame?.controllerId);
  const live = useRecorderLive();
  const open = useRecorderStore((s) => s.open);
  const steps = useRecorderStore((s) => s.steps);
  const current = useRecorderStore((s) => s.current);
  const dirty = useRecorderStore((s) => s.dirty);
  const busy = useRecorderStore((s) => s.busy);
  const resourcePath = useRecorderStore((s) => s.resourcePath);
  const setResourcePath = useRecorderStore((s) => s.setResourcePath);
  const controllerId = useMFWStore((s) => s.controllerId);
  const connected = useMFWStore((s) => s.connectionStatus === "connected");
  const bundles = useLocalFileStore((s) => s.resourceBundles);
  const { token } = theme.useToken();
  const actions = useRecorderActions();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const navigate = (next: () => void) => {
    if (dirty) setPending(() => next);
    else next();
  };
  const analyzing = steps.filter((s) => s.suggestion === "pending").length;
  const unverified = steps.filter(
    (step) =>
      !step.result?.success ||
      !step.result.hit ||
      step.result.action_success === false,
  ).length;
  const validResource = bundles.some((b) => b.abs_path === resourcePath);
  const colors = {
    "--rec-bg": token.colorBgLayout,
    "--rec-panel": token.colorBgContainer,
    "--rec-border": token.colorBorderSecondary,
    "--rec-text": token.colorText,
    "--rec-muted": token.colorTextSecondary,
    "--rec-accent": token.colorPrimary,
    "--rec-selected": token.colorPrimaryBg,
  } as CSSProperties;
  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Modal
        open={open}
        title="MPE Recorder"
        width="calc(100vw - 40px)"
        style={{ paddingBottom: 0 }}
        styles={{ body: { height: "calc(100dvh - 128px)", minHeight: 300 } }}
        footer={null}
        mask={{ closable: false }}
        onCancel={() => useRecorderStore.getState().setOpen(false)}
        afterClose={() => setPending(null)}
        destroyOnHidden
      >
        <div className={styles.workbench} style={colors}>
          <header className={styles.topbar}>
            <Button
              type="primary"
              danger={recording}
              disabled={
                busy ||
                !connected ||
                detailsOpen ||
                !liveController ||
                liveController !== controllerId
              }
              onClick={() =>
                useRecorderStore.getState().setRecording(!recording)
              }
            >
              {recording ? "暂停录制" : "开始录制"}
            </Button>
            <Tag color={recording ? "error" : "default"}>
              {recording ? "录制中 · 点击自动记录" : "自由操作 · 不记录"}
            </Tag>
            <Tag color={connected ? "success" : "default"}>
              {connected ? "设备已连接" : "设备未连接"}
            </Tag>
            {!detailsOpen && connected && (
              <span className={styles.hint}>
                画面 {live.actualFrameRate} / {live.refreshRate} FPS
              </span>
            )}
            {detailsOpen && (
              <Button
                icon={<ReloadOutlined />}
                disabled={busy || !controllerId}
                onClick={actions.refresh}
              >
                获取截图
              </Button>
            )}
            <Select
              className={styles.resource}
              aria-label="识别与模板资源包"
              placeholder="选择资源包（模板保存必选）"
              value={validResource ? resourcePath : undefined}
              allowClear
              disabled={busy}
              options={bundles.map((b) => ({
                value: b.abs_path,
                label: b.rel_path || b.name,
              }))}
              onChange={(value) => setResourcePath(value ?? "")}
            />
            {analyzing > 0 && (
              <>
                <span className={styles.hint}>{analyzing} 步文字分析中</span>
                <Button
                  size="small"
                  onClick={() => useRecorderStore.getState().skipSuggestions()}
                >
                  跳过文字分析
                </Button>
              </>
            )}
            <span className={styles.grow} />
            <span className={styles.hint}>
              {steps.length} 个步骤 · {unverified} 个未通过验证
            </span>
            <Button
              type="primary"
              disabled={busy || steps.length === 0 || analyzing > 0}
              onClick={() => navigate(actions.generate)}
            >
              生成草稿
            </Button>
          </header>
          <div
            className={`${styles.columns} ${!detailsOpen ? styles.liveColumns : ""}`}
          >
            <aside className={styles.steps} aria-label="已保存步骤">
              <div className={styles.sectionHeading}>
                <h3>已保存步骤</h3>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={busy}
                  onClick={() =>
                    navigate(() => {
                      useRecorderStore.getState().select();
                      useRecorderStore.getState().setDetailsOpen(true);
                      useRecorderStore.getState().setRecording(false);
                      const liveFrame = useRecorderStore.getState().liveFrame;
                      if (liveFrame)
                        useRecorderStore.getState().setFrame(liveFrame);
                    })
                  }
                >
                  新建
                </Button>
              </div>
              {!steps.length && (
                <p className={styles.hint}>
                  开始录制后，在右侧画面直接操作。点击会自动留下步骤与模板候选，无需逐步保存。
                </p>
              )}
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`${styles.step} ${step.id === current.id ? styles.selected : ""}`}
                >
                  <button
                    title={step.suggestionError}
                    className={styles.stepSelect}
                    disabled={busy}
                    onClick={() => {
                      navigate(() => {
                        useRecorderStore.getState().select(step.id);
                        useRecorderStore.getState().setDetailsOpen(true);
                        useRecorderStore.getState().setRecording(false);
                      });
                    }}
                  >
                    {step.config.templateImage && (
                      <img
                        src={step.config.templateImage}
                        alt="点击附近模板候选"
                        className={styles.captureThumb}
                      />
                    )}
                    <strong>
                      {index + 1}. {step.config.name}
                    </strong>
                    <span>
                      {step.config.recognition} · {step.config.action}
                    </span>
                    <span>
                      {step.capture && (
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
                        : step.suggestion === "ocr"
                          ? "OCR 优选 · "
                          : step.suggestion === "unavailable"
                            ? "OCR 不可用 · "
                            : ""}
                      {!step.result
                        ? step.capture
                          ? "自动候选 · 待验证"
                          : "未验证"
                        : !step.result.success
                          ? "验证失败"
                          : step.result.hit
                            ? "识别已通过"
                            : "识别未命中"}
                    </span>
                  </button>
                  <div className={styles.stepTools}>
                    <Button
                      size="small"
                      type="text"
                      aria-label={`上移步骤 ${index + 1}`}
                      icon={<UpOutlined />}
                      disabled={busy || index === 0}
                      onClick={() =>
                        useRecorderStore.getState().move(step.id, -1)
                      }
                    />
                    <Button
                      size="small"
                      type="text"
                      aria-label={`下移步骤 ${index + 1}`}
                      icon={<DownOutlined />}
                      disabled={busy || index === steps.length - 1}
                      onClick={() =>
                        useRecorderStore.getState().move(step.id, 1)
                      }
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      aria-label={`删除步骤 ${index + 1}`}
                      icon={<DeleteOutlined />}
                      disabled={busy}
                      onClick={() =>
                        navigate(() =>
                          useRecorderStore.getState().remove(step.id),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </aside>
            <RecorderCanvas
              key={detailsOpen ? current.id : "live"}
              onClick={live.click}
            />
            {detailsOpen && (
              <RecorderFields
                candidates={actions.candidates}
                extract={() => actions.run("extract")}
              />
            )}
          </div>
          <footer className={styles.bottomBar}>
            <span className={styles.hint}>
              关闭保留本次录制；刷新或退出应用后不恢复。
              {dirty ? " · 当前步骤尚未保存" : ""}
            </span>
            <span className={styles.grow} />
            {detailsOpen ? (
              <>
                <Button
                  disabled={busy}
                  onClick={() =>
                    navigate(() =>
                      useRecorderStore.getState().setDetailsOpen(false),
                    )
                  }
                >
                  返回操作画面
                </Button>
                <Button
                  disabled={busy || !current.frame}
                  onClick={() => actions.run("preview")}
                >
                  试识别
                </Button>
                <Button
                  disabled={busy || !current.frame || !controllerId}
                  loading={busy}
                  onClick={() => actions.run("execute")}
                >
                  执行当前步骤
                </Button>
                <Button type="primary" disabled={busy} onClick={actions.save}>
                  {steps.some((s) => s.id === current.id)
                    ? "更新步骤"
                    : "保存步骤"}
                </Button>
              </>
            ) : (
              <span className={styles.hint}>
                {live.error ||
                  "自动模板仅为候选，点击左侧步骤可修正 OCR、模板与 ROI。"}
              </span>
            )}
          </footer>
        </div>
      </Modal>
      <Modal
        open={!!pending}
        title="当前步骤有未保存的编辑"
        onCancel={() => setPending(null)}
        footer={
          <>
            <Button onClick={() => setPending(null)}>取消</Button>
            <Button
              onClick={() => {
                const next = pending;
                const state = useRecorderStore.getState();
                state.select(state.current.id);
                setPending(null);
                next?.();
              }}
            >
              放弃编辑并继续
            </Button>
            <Button
              type="primary"
              onClick={() => {
                if (actions.save()) {
                  const next = pending;
                  setPending(null);
                  next?.();
                }
              }}
            >
              保存并继续
            </Button>
          </>
        }
      >
        保存只记录配置，不会操作设备。
      </Modal>
    </div>
  );
}
