import style from "../../../styles/panels/LiveScreenPanel.module.less";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Spin, message } from "antd";
import classNames from "classnames";

import { useMFWStore } from "../../../stores/mfwStore";
import { useConfigStore } from "../../../stores/configStore";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import { mfwProtocol } from "../../../services/server";

// 连续截图失败阈值，超过此值自动断开设备连接
const SCREENCAP_FAILURE_THRESHOLD = 3;

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
  const isRequestingRef = useRef(false);
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

  // 注册截图结果监听
  useEffect(() => {
    const unregister = mfwProtocol.onScreencapResult(
      (data: { success: boolean; image?: string; error?: string }) => {
        isRequestingRef.current = false;
        if (data.success && data.image) {
          setScreenImage(data.image);
          setIsLoading(false);
          setHasError(false);
          // 成功时重置连续失败计数
          consecutiveFailuresRef.current = 0;
        } else {
          setHasError(true);
          setIsLoading(false);
          // 连续失败计数，超过阈值自动断开设备连接
          consecutiveFailuresRef.current++;
          if (consecutiveFailuresRef.current >= SCREENCAP_FAILURE_THRESHOLD) {
            console.warn(
              "[LiveScreenPanel] 连续截图失败次数超过阈值，自动断开设备连接",
            );
            message.warning("设备连接异常，已自动断开");
            clearConnection();
          }
        }
      },
    );

    return unregister;
  }, [clearConnection]);

  // 定时截图请求
  const requestScreenshot = useCallback(() => {
    if (!controllerId || isRequestingRef.current) return;
    // 页面不可见时跳过请求
    if (!isPageVisibleRef.current) return;
    isRequestingRef.current = true;
    mfwProtocol.requestScreencap({
      controller_id: controllerId,
      target_long_side: 400,
    });
  }, [controllerId]);

  useEffect(() => {
    if (!shouldShow || !controllerId) {
      return;
    }

    // 重置状态
    setIsLoading(true);
    setHasError(false);
    requestScreenshot();

    const timerId = setInterval(requestScreenshot, liveScreenRefreshRate);

    return () => {
      clearInterval(timerId);
      isRequestingRef.current = false;
    };
  }, [shouldShow, liveScreenRefreshRate, controllerId, requestScreenshot]);

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
  );

  return (
    <div className={panelClass}>
      <div className={style.header}>
        <span className={style.title}>实时画面</span>
        {hasError && <span className={style.status}>截图异常</span>}
      </div>
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
    </div>
  );
});

export default LiveScreenPanel;
