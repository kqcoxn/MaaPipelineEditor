import style from "../../../styles/panels/LiveScreenPanel.module.less";

import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button, Spin, Tooltip, message } from "antd";
import classNames from "classnames";

import { useMFWStore } from "@/stores/connection/mfwStore";
import {
  getLiveScreenFrameInterval,
  useConfigStore,
} from "@/stores/app/configStore";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import { mfwProtocol } from "../../../services/server";

// 连续截图失败阈值，超过此值自动断开设备连接
const SCREENCAP_FAILURE_THRESHOLD = 3;
const SCREENCAP_BUSY_RETRY_DELAY_MS = 250;
const SCREENCAP_FAILURE_RETRY_DELAY_MS = 1000;
const SCREENCAP_IDLE_RETRY_DELAY_MS = 1000;
const SCREENCAP_BUSY_ERROR = "screencap busy";
const SCREENCAP_SKIPPED_ERROR = "screencap skipped";
const ACTUAL_FRAME_RATE_SAMPLE_INTERVAL_MS = 1000;

type ScreenshotRequestResult =
  | "success"
  | "busy"
  | "failed"
  | "skipped"
  | "superseded";

const LiveScreenPanel = memo(() => {
  const connectionStatus = useMFWStore((state) => state.connectionStatus);
  const controllerId = useMFWStore((state) => state.controllerId);
  const clearConnection = useMFWStore((state) => state.clearConnection);
  const { isDisplaced } = usePanelOccupancy("liveScreen");
  const enableLiveScreen = useConfigStore(
    (state) => state.configs.enableLiveScreen,
  );
  const liveScreenRefreshRate = useConfigStore(
    (state) => state.configs.liveScreenRefreshRate,
  );

  const [screenImage, setScreenImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [actualFrameRate, setActualFrameRate] = useState(0);
  const isRequestingRef = useRef(false);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const successfulFrameCountRef = useRef(0);

  // 页面不可见时暂停截图请求
  const isPageVisibleRef = useRef(document.visibilityState === "visible");
  useEffect(() => {
    const handler = () => {
      isPageVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // 检查面板可见性
  const shouldShow =
    connectionStatus === "connected" &&
    controllerId !== null &&
    !isDisplaced &&
    enableLiveScreen;
  const shouldRequestScreen = shouldShow && !isCollapsed;

  const handleScreenshotFailure = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    consecutiveFailuresRef.current++;
    if (consecutiveFailuresRef.current >= SCREENCAP_FAILURE_THRESHOLD) {
      console.warn(
        "[LiveScreenPanel] 连续截图失败次数超过阈值，自动断开设备连接",
      );
      message.warning("设备连接异常，已自动断开");
      clearConnection();
    }
  }, [clearConnection]);

  const requestScreenshot = useCallback(async (): Promise<ScreenshotRequestResult> => {
    if (!controllerId || isRequestingRef.current) return "skipped";
    // 页面不可见时跳过请求
    if (!isPageVisibleRef.current) return "skipped";

    isRequestingRef.current = true;
    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;
    try {
      const result = await mfwProtocol.requestScreencap(
        {
          controller_id: controllerId,
          background: true,
          output_long_side: 400,
        },
        abortController.signal,
      );
      if (abortController.signal.aborted) return "skipped";

      if (result.success && result.image) {
        setScreenImage(result.image);
        setIsLoading(false);
        setHasError(false);
        consecutiveFailuresRef.current = 0;
        successfulFrameCountRef.current++;
        return "success";
      } else if (result.error === SCREENCAP_BUSY_ERROR) {
        return "busy";
      } else if (result.error === SCREENCAP_SKIPPED_ERROR) {
        return "superseded";
      } else {
        handleScreenshotFailure();
        return "failed";
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "skipped";
      }
      handleScreenshotFailure();
      return "failed";
    } finally {
      if (requestAbortControllerRef.current === abortController) {
        requestAbortControllerRef.current = null;
        isRequestingRef.current = false;
      }
    }
  }, [controllerId, handleScreenshotFailure]);

  useEffect(() => {
    if (!shouldRequestScreen || !controllerId) {
      return;
    }

    // 重置状态
    setIsLoading(true);
    setHasError(false);
    let stopped = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const frameInterval = getLiveScreenFrameInterval(liveScreenRefreshRate);

    const scheduleNextFrame = (delay: number) => {
      if (stopped) return;
      timerId = setTimeout(captureNextFrame, delay);
    };

    const captureNextFrame = async () => {
      const startedAt = performance.now();
      const result = await requestScreenshot();
      if (stopped) return;

      if (result === "busy") {
        scheduleNextFrame(SCREENCAP_BUSY_RETRY_DELAY_MS);
        return;
      }
      if (result === "failed") {
        scheduleNextFrame(SCREENCAP_FAILURE_RETRY_DELAY_MS);
        return;
      }
      if (result === "skipped") {
        scheduleNextFrame(SCREENCAP_IDLE_RETRY_DELAY_MS);
        return;
      }
      if (result === "superseded") {
        scheduleNextFrame(SCREENCAP_BUSY_RETRY_DELAY_MS);
        return;
      }

      const elapsed = performance.now() - startedAt;
      scheduleNextFrame(Math.max(0, frameInterval - elapsed));
    };

    void captureNextFrame();

    return () => {
      stopped = true;
      if (timerId !== undefined) clearTimeout(timerId);
      requestAbortControllerRef.current?.abort();
      requestAbortControllerRef.current = null;
      isRequestingRef.current = false;
    };
  }, [
    shouldRequestScreen,
    liveScreenRefreshRate,
    controllerId,
    requestScreenshot,
  ]);

  useEffect(() => {
    successfulFrameCountRef.current = 0;
    setActualFrameRate(0);
    if (!shouldRequestScreen) return;

    let sampleStartedAt = performance.now();
    const sampleTimerId = setInterval(() => {
      const now = performance.now();
      const elapsed = now - sampleStartedAt;
      const measuredFrameRate = Math.round(
        (successfulFrameCountRef.current * 1000) / elapsed,
      );
      successfulFrameCountRef.current = 0;
      sampleStartedAt = now;
      setActualFrameRate(measuredFrameRate);
    }, ACTUAL_FRAME_RATE_SAMPLE_INTERVAL_MS);

    return () => clearInterval(sampleTimerId);
  }, [controllerId, shouldRequestScreen]);

  // 设备断开时清除画面
  useEffect(() => {
    if (connectionStatus === "disconnected") {
      setScreenImage(null);
      setIsLoading(true);
      setHasError(false);
      // 重置连续失败计数器
      consecutiveFailuresRef.current = 0;
    }
  }, [connectionStatus]);

  const panelClass = classNames(
    style.liveScreenPanel,
    shouldShow ? style.visible : style.hidden,
    isCollapsed && style.collapsed,
  );

  return (
    <div className={panelClass}>
      <div className={style.header}>
        <div className={style.titleGroup}>
          <span className={style.title}>实时画面</span>
          <span
            className={style.frameRate}
            aria-label={`当前实际帧率 ${actualFrameRate} 帧每秒`}
          >
            {actualFrameRate} 帧/秒
          </span>
        </div>
        <div className={style.headerActions}>
          {hasError && !isCollapsed && (
            <span className={style.status}>截图异常</span>
          )}
          <Tooltip
            placement="left"
            title={isCollapsed ? "展开实时画面" : "折叠实时画面"}
          >
            <Button
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "展开实时画面" : "折叠实时画面"}
              className={style.collapseButton}
              icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
              size="small"
              type="text"
              onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            />
          </Tooltip>
        </div>
      </div>
      {!isCollapsed && (
        <div className={style.contentContainer}>
          {isLoading && !screenImage ? (
            <div className={style.loadingContainer}>
              <Spin />
              <span>正在获取画面...</span>
            </div>
          ) : hasError && !screenImage ? (
            <div className={style.errorContainer}>
              <span>截图失败，请检查设备连接</span>
            </div>
          ) : screenImage ? (
            <img
              className={style.screenImage}
              src={screenImage}
              alt="设备画面"
              draggable={false}
            />
          ) : null}
        </div>
      )}
    </div>
  );
});

export default LiveScreenPanel;
