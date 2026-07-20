import style from "../../../styles/panels/LiveScreenPanel.module.less";

import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Spin, Tooltip, message } from "antd";
import classNames from "classnames";

import { useMFWStore } from "../../../stores/mfwStore";
import { useConfigStore } from "../../../stores/configStore";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import { mfwProtocol } from "../../../services/server";

// 连续截图失败阈值，超过此值自动断开设备连接
const SCREENCAP_FAILURE_THRESHOLD = 3;

const LiveScreenPanel = memo(() => {
  const { t } = useTranslation();
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
  const isRequestingRef = useRef(false);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const consecutiveFailuresRef = useRef(0);

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
        "[LiveScreenPanel] Screencap failure threshold exceeded, auto disconnecting",
      );
      message.warning(
        t(
          "ui.panels.main.liveScreen.autoDisconnectMessage",
          "设备连接异常，已自动断开",
        ),
      );
      clearConnection();
    }
  }, [clearConnection, t]);

  // 定时截图请求
  const requestScreenshot = useCallback(async () => {
    if (!controllerId || isRequestingRef.current) return;
    // 页面不可见时跳过请求
    if (!isPageVisibleRef.current) return;

    isRequestingRef.current = true;
    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;
    try {
      const result = await mfwProtocol.requestScreencap(
        {
          controller_id: controllerId,
          output_long_side: 400,
        },
        abortController.signal,
      );
      if (abortController.signal.aborted) return;

      if (result.success && result.image) {
        setScreenImage(result.image);
        setIsLoading(false);
        setHasError(false);
        consecutiveFailuresRef.current = 0;
      } else {
        handleScreenshotFailure();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        handleScreenshotFailure();
      }
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
    requestScreenshot();

    const timerId = setInterval(requestScreenshot, liveScreenRefreshRate);

    return () => {
      clearInterval(timerId);
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

  const expandLabel = t("ui.panels.main.liveScreen.expand", "展开实时画面");
  const collapseLabel = t("ui.panels.main.liveScreen.collapse", "折叠实时画面");

  return (
    <div className={panelClass}>
      <div className={style.header}>
        <span className={style.title}>
          {t("ui.panels.main.liveScreen.title", "实时画面")}
        </span>
        <div className={style.headerActions}>
          {hasError && !isCollapsed && (
            <span className={style.status}>
              {t("ui.panels.main.liveScreen.screenshotError", "截图异常")}
            </span>
          )}
          <Tooltip placement="left" title={isCollapsed ? expandLabel : collapseLabel}>
            <Button
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? expandLabel : collapseLabel}
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
              <span>
                {t("ui.panels.main.liveScreen.loading", "正在获取画面...")}
              </span>
            </div>
          ) : hasError && !screenImage ? (
            <div className={style.errorContainer}>
              <span>
                {t(
                  "ui.panels.main.liveScreen.screenshotFailed",
                  "截图失败，请检查设备连接",
                )}
              </span>
            </div>
          ) : screenImage ? (
            <img
              className={style.screenImage}
              src={screenImage}
              alt={t("ui.panels.main.liveScreen.deviceScreen", "设备画面")}
              draggable={false}
            />
          ) : null}
        </div>
      )}
    </div>
  );
});

export default LiveScreenPanel;
