import { useState, type CSSProperties } from "react";
import { Modal, Button, Select, theme } from "antd";
import {
  CaretRightOutlined,
  PauseOutlined,
} from "@ant-design/icons";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useRecorderStore } from "./store";
import { RecorderCanvas } from "./RecorderCanvas";
import IconFont from "@/components/iconfonts";
import { RecorderSteps } from "./RecorderSteps";
import { useRecorderLive } from "./useRecorderLive";
import { useRecorderActions } from "./useRecorderActions";
import styles from "./Recorder.module.less";

export default function RecorderWorkbench() {
  const [closeRequested, setCloseRequested] = useState(false);
  const recording = useRecorderStore((s) => s.recording);
  const detailsOpen = useRecorderStore((s) => s.detailsOpen);
  const liveController = useRecorderStore((s) => s.liveFrame?.controllerId);
  const live = useRecorderLive(!closeRequested);
  const open = useRecorderStore((s) => s.open);
  const steps = useRecorderStore((s) => s.steps);
  const current = useRecorderStore((s) => s.current);
  const busy = useRecorderStore((s) => s.busy);
  const resourcePath = useRecorderStore((s) => s.resourcePath);
  const setResourcePath = useRecorderStore((s) => s.setResourcePath);
  const controllerId = useMFWStore((s) => s.controllerId);
  const connected = useMFWStore((s) => s.connectionStatus === "connected");
  const bundles = useLocalFileStore((s) => s.resourceBundles);
  const { token } = theme.useToken();
  const actions = useRecorderActions();
  const analyzing = steps.filter((s) => s.suggestion === "pending").length;
  const validResource = bundles.some((b) => b.abs_path === resourcePath);
  const requestClose = () => {
    const state = useRecorderStore.getState();
    if (state.busy) return;
    if (state.steps.length) setCloseRequested(true);
    else state.reset();
  };
  const resourceSelect = (
    <Select
      className={styles.resource}
      aria-label="识别与模板资源包"
      placeholder="选择资源包（保存模板必选）"
      value={validResource ? resourcePath : undefined}
      allowClear
      disabled={busy}
      options={bundles.map((b) => ({ value: b.abs_path, label: b.rel_path || b.name }))}
      onChange={(value) => setResourcePath(value ?? "")}
    />
  );
  const colors = {
    "--rec-bg": token.colorBgLayout,
    "--rec-panel": token.colorBgContainer,
    "--rec-border": token.colorBorderSecondary,
    "--rec-text": token.colorText,
    "--rec-muted": token.colorTextSecondary,
    "--rec-accent": token.colorPrimary,
    "--rec-selected": token.colorPrimaryBg,
    "--rec-hover": token.colorFillTertiary,
    "--rec-success": token.colorSuccess,
  } as CSSProperties;
  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Modal
        open={open}
        title={<div className={styles.title}><IconFont name="icon-luxiang" size={24} /><span>MPE Recorder</span><span className={styles.titleHint}>流程录制</span></div>}
        width="calc(100vw - 40px)"
        styles={{ body: { height: "calc(100dvh - 128px)", minHeight: 300 } }}
        footer={null}
        mask={{ closable: false }}
        onCancel={requestClose}
        closable={!busy && !closeRequested}
        keyboard={!busy && !closeRequested}
        destroyOnHidden
      >
        <div className={styles.workbench} style={colors}>
          <header className={styles.topbar}>
            <div className={styles.recordControls}>
              <Button
                type="primary"
                danger={recording}
                icon={recording ? <PauseOutlined /> : <CaretRightOutlined />}
                disabled={
                  busy ||
                  (!recording && !detailsOpen &&
                    (!connected || !liveController || liveController !== controllerId))
                }
                onClick={() =>
                  useRecorderStore.getState().setRecording(!recording)
                }
              >
                {detailsOpen ? "继续录制" : recording ? "暂停录制" : "开始录制"}
              </Button>
              <div className={styles.recordStatus} title={detailsOpen ? "点击继续录制，返回实时画面" : recording ? "点击画面自动记录步骤" : "点击操作设备，不记录步骤"}>
                <strong>{detailsOpen ? "步骤回看" : recording ? "录制中" : "自由操作"}</strong>
              </div>
              <span className={`${styles.connection} ${connected ? styles.connected : ""}`}>{connected ? "设备已连接" : "设备未连接"}</span>
              {!detailsOpen && connected && <span className={styles.hint}>{live.actualFrameRate} / {live.refreshRate} FPS</span>}
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
            </div>
            <div className={styles.exportControls}>
              <span className={styles.hint}>{steps.length} 个步骤</span>
              {resourceSelect}
              <Button
                type="primary"
                disabled={busy || steps.length === 0 || analyzing > 0}
                onClick={() => actions.generate()}
              >
                生成草稿
              </Button>
            </div>
          </header>
          <div className={styles.columns}>
            <RecorderSteps />
            <RecorderCanvas
              key={detailsOpen ? current.id : "live"}
              onClick={live.click}
            />
          </div>
          <footer className={styles.bottomBar}>
            <span className={styles.hint}>
              {live.error || "生成草稿后，可在画布调整顺序、识别条件和动作参数。"}
            </span>
            <span className={styles.grow} />
            <span className={styles.hint}>关闭前可应用或清除本次录制。</span>
          </footer>
        </div>
      </Modal>
      <Modal
        open={closeRequested}
        destroyOnHidden
        title="结束本次录制？"
        onCancel={() => setCloseRequested(false)}
        closable={!busy}
        keyboard={!busy}
        mask={{ closable: false }}
        footer={<>
          <Button disabled={busy} onClick={() => setCloseRequested(false)}>取消</Button>
          <Button danger disabled={busy} onClick={() => useRecorderStore.getState().reset()}>清除并关闭</Button>
          <Button type="primary" loading={busy} disabled={busy || analyzing > 0}
            onClick={() => actions.generate()}>应用并关闭</Button>
        </>}
      >
        <p>本次录制有 {steps.length} 个步骤。应用会生成草稿到当前画布；清除会丢弃本次录制。</p>
        {steps.some((step) => step.config.recognition === "TemplateMatch") && resourceSelect}
        {analyzing > 0 && <p>{analyzing} 个步骤正在分析，请等待完成后应用，或返回面板跳过文字分析。</p>}
      </Modal>
    </div>
  );
}
