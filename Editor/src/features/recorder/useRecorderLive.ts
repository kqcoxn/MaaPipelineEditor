import { useEffect, useRef, useState } from "react";
import { mfwProtocol, recorderProtocol } from "@/services/server";
import {
  getLiveScreenFrameInterval,
  useConfigStore,
} from "@/stores/app/configStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { message } from "@/utils/ui/antdAppApi";
import { useRecorderStore } from "./store";
import { enqueueSuggestion } from "./suggestions";
import { createCapture } from "./capture";
import type { RecorderFrame, RecorderStep } from "./types";

export function useRecorderLive(active = true) {
  const refreshRate = useConfigStore((s) => s.configs.liveScreenRefreshRate);
  const controllerId = useMFWStore((s) => s.controllerId);
  const detailsOpen = useRecorderStore((s) => s.detailsOpen);
  const open = useRecorderStore((s) => s.open);
  const refreshNow = useRef<() => void>(() => {});
  const [error, setError] = useState<string>();
  const [actualFrameRate, setActualFrameRate] = useState(0);
  useEffect(() => {
    setActualFrameRate(0);
    if (!active || !open || detailsOpen || !controllerId) return;
    let frameCount = 0;
    let sampleStart = performance.now();
    const sampleTimer = setInterval(() => {
      const now = performance.now();
      setActualFrameRate(Math.round((frameCount * 1000) / (now - sampleStart)));
      frameCount = 0;
      sampleStart = now;
    }, 1000);
    const interval = getLiveScreenFrameInterval(refreshRate);
    let stopped = false;
    let inFlight = false;
    let refreshAgain = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (stopped) return;
      if (inFlight) {
        refreshAgain = true;
        return;
      }
      const startedAt = performance.now();
      let retryDelay = interval;
      clearTimeout(timer);
      inFlight = true;
      if (
        !useRecorderStore.getState().busy &&
        document.visibilityState === "visible"
      ) {
        try {
          const result = await mfwProtocol.requestScreencap(
            { controller_id: controllerId, use_cache: false, background: true },
            abort.signal,
          );
          if (stopped || useMFWStore.getState().controllerId !== controllerId)
            return;
          if (result.success && result.image && result.width && result.height) {
            useRecorderStore.getState().setLiveFrame({
              image: result.image,
              width: result.width,
              height: result.height,
              controllerId,
            });
            frameCount++;
            setError(undefined);
          } else if (!/busy|skipped/.test(result.error ?? "")) {
            setError(result.error || "画面刷新失败");
            retryDelay = 1000;
          } else retryDelay = Math.max(interval, 100);
        } catch (e) {
          if (!stopped) setError(String(e));
          retryDelay = 1000;
        }
      }
      inFlight = false;
      if (!stopped)
        timer = setTimeout(
          refresh,
          document.visibilityState !== "visible"
            ? 1000
            : refreshAgain
              ? 0
              : Math.max(0, retryDelay - (performance.now() - startedAt)),
        );
      refreshAgain = false;
    };
    refreshNow.current = () => {
      void refresh();
    };
    void refresh();
    return () => {
      stopped = true;
      refreshNow.current = () => {};
      abort.abort();
      clearInterval(sampleTimer);
      clearTimeout(timer);
    };
  }, [active, controllerId, detailsOpen, open, refreshRate]);

  const click = async (
    frame: RecorderFrame,
    image: HTMLImageElement,
    x: number,
    y: number,
  ) => {
    const state = useRecorderStore.getState();
    if (!active || state.busy || state.detailsOpen) return;
    if (
      !controllerId ||
      useMFWStore.getState().controllerId !== frame.controllerId
    ) {
      message.warning("设备已变化，请等待画面刷新");
      return;
    }
    if (state.recording && state.steps.length >= 200) {
      state.setRecording(false);
      message.warning("本次录制已达 200 步，请先生成草稿");
      return;
    }
    state.setBusy(true);
    let stepId: string | undefined;
    let captured: RecorderStep | undefined;
    try {
      // Dispatch first; screenshot/candidate processing must not delay input.
      const pending = recorderProtocol.click({
        controller_id: frame.controllerId,
        x,
        y,
        width: frame.width,
        height: frame.height,
      });
      if (state.recording) {
        const step = createCapture(frame, image, x, y, state.steps.length);
        step.suggestion = "pending";
        captured = step;
        stepId = step.id;
        state.appendCapture(step);
      }
      const result = await pending;
      if (stepId)
        useRecorderStore.getState().finishCapture(stepId, {
          status: result.success ? "success" : "failed",
          error: result.error,
        });
      if (!result.success) message.error(result.error || "点击失败");
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (stepId)
        useRecorderStore
          .getState()
          .finishCapture(stepId, { status: "unknown", error });
      message.error(error);
    } finally {
      useRecorderStore.getState().setBusy(false);
      refreshNow.current();
      if (captured) void enqueueSuggestion(captured, state.sessionId);
    }
  };
  return { click, error, actualFrameRate, refreshRate };
}
