import style from "../../../styles/LiveScreenPanel.module.less";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Spin } from "antd";
import classNames from "classnames";

import { useMFWStore } from "../../../stores/mfwStore";
import { useToolbarStore } from "../../../stores/toolbarStore";
import { useConfigStore } from "../../../stores/configStore";
import { useFlowStore } from "../../../stores/flow";
import { mfwProtocol } from "../../../services/server";

const LiveScreenPanel = memo(() => {
  const connectionStatus = useMFWStore((state) => state.connectionStatus);
  const controllerId = useMFWStore((state) => state.controllerId);
  const jsonPanelVisible = useToolbarStore(
    (state) => state.jsonPanelVisible
  );
  const targetNode = useFlowStore((state) => state.targetNode);
  const selectedEdges = useFlowStore((state) => state.selectedEdges);
  const enableLiveScreen = useConfigStore(
    (state) => state.configs.enableLiveScreen
  );
  const liveScreenRefreshRate = useConfigStore(
    (state) => state.configs.liveScreenRefreshRate
  );

  const [screenImage, setScreenImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isRequestingRef = useRef(false);

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
  const hasFieldPanel = targetNode !== null;
  const hasEdgePanel = selectedEdges.length === 1 && !targetNode;
  const hasOtherPanel = jsonPanelVisible || hasFieldPanel || hasEdgePanel;

  const shouldShow =
    connectionStatus === "connected" &&
    controllerId !== null &&
    !hasOtherPanel &&
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
        } else {
          setHasError(true);
          setIsLoading(false);
        }
      }
    );

    return unregister;
  }, []);

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
    }
  }, [connectionStatus]);

  const panelClass = classNames(
    style.liveScreenPanel,
    shouldShow ? style.visible : style.hidden
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
