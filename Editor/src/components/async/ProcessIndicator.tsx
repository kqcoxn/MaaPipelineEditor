import { Button, Progress } from "antd";
import {
  ExclamationCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import classNames from "classnames";

import style from "@/styles/components/AsyncFeature.module.less";

interface ProcessIndicatorProps {
  label: string;
  detail?: string;
  progress?: number;
  mode?: "fullscreen" | "inline";
  error?: boolean;
  onRetry?: () => void;
}

export function ProcessIndicator({
  label,
  detail = "正在准备所需资源",
  progress = 12,
  mode = "fullscreen",
  error = false,
  onRetry,
}: ProcessIndicatorProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={mode === "fullscreen" ? style.overlay : style.inline}
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      <div className={classNames(style.surface, error && style.errorSurface)}>
        {error ? (
          <>
            <div className={style.header}>
              <span className={classNames(style.icon, style.errorIcon)}>
                <ExclamationCircleOutlined />
              </span>
              <div className={style.copy}>
                <strong>{label}</strong>
                <span>{detail}</span>
              </div>
            </div>
            <div className={style.errorAction}>
              <Button
                icon={<ReloadOutlined />}
                aria-label="重试加载"
                onClick={onRetry}
              >
                重试加载
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={style.header}>
              <span className={style.icon}>
                <LoadingOutlined spin />
              </span>
              <div className={style.copy}>
                <strong>{label}</strong>
                <span>{detail}</span>
              </div>
            </div>
            <Progress
              className={style.progress}
              percent={normalizedProgress}
              showInfo={false}
              status="active"
              strokeLinecap="square"
              size={["100%", 4]}
            />
            <div className={style.meta}>
              <span className={style.activity}>
                <i />
                处理中
              </span>
              <span>{Math.round(normalizedProgress)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
