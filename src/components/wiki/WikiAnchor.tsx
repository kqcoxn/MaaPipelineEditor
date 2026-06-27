import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useWikiStore } from "../../stores/wikiStore";
import style from "../../styles/components/WikiAnchor.module.less";

const DOCS_BASE_URL = "https://mpe.codax.site/docs/01.指南/";
const HOLD_DURATION_MS = 1000;

export interface WikiAnchorProps {
  /** 文档路径，相对于 /docs/01.指南/ 的路径，如 "10.工作流面板/30.字段面板.html" */
  path: string;
  /** tooltip 标题 */
  title: string;
  /** tooltip 简要介绍 */
  description?: string;
}

/**
 * Wiki 锚点组件
 * 悬浮显示 Tooltip（标题 + 简介 + 操作提示）
 * 悬浮状态下长按 W 或长按鼠标触发进度条蓄力，完成后跳转文档站
 * 使用 CSS transition 驱动动画，避免高频 React 重渲染
 */
function WikiAnchorBase({ path, title, description }: WikiAnchorProps) {
  const setActivePath = useWikiStore((s) => s.setActivePath);
  const clearActivePath = useWikiStore((s) => s.clearActivePath);

  const [hovered, setHovered] = useState(false);
  const [holding, setHolding] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoveredRef = useRef(false);
  const holdingRef = useRef(false);

  const fullUrl = `${DOCS_BASE_URL}${path}`;

  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  const startHold = useCallback(() => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);

    timerRef.current = setTimeout(() => {
      holdingRef.current = false;
      setHolding(false);
      window.open(fullUrl, "_blank");
    }, HOLD_DURATION_MS);
  }, [fullUrl]);

  const cancelHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);

    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  // 监听键盘 W（仅在 hover 时生效）
  useEffect(() => {
    if (!hovered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "w") return;
      if (e.repeat) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!hoveredRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      startHold();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "w") {
        cancelHold();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
      cancelHold();
    };
  }, [hovered, startHold, cancelHold]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startHold();
  };

  const handleMouseUp = () => {
    cancelHold();
  };

  const handleMouseEnter = () => {
    setHovered(true);
    setActivePath(path);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    clearActivePath(path);
    cancelHold();
  };

  const tooltipContent = (
    <div className={style.tipContent}>
      <div className={style.tipTitle}>{title}</div>
      {description && <div className={style.tipDesc}>{description}</div>}
      <div className={style.tipHint}>长按 W 或长按图标查看详情</div>
      <div className={style.progressBar} style={{ opacity: holding ? 1 : 0 }}>
        <div
          className={style.progressFill}
          style={{
            width: holding ? "100%" : "0%",
            transition: holding
              ? `width ${HOLD_DURATION_MS}ms linear`
              : "none",
          }}
        />
      </div>
    </div>
  );

  return (
    <Tooltip
      title={tooltipContent}
      placement="bottom"
      open={hovered}
      overlayClassName={style.tooltipOverlay}
    >
      <span
        className={style.wikiAnchor}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        aria-label={title}
      >
        <QuestionCircleOutlined className={style.icon} />
      </span>
    </Tooltip>
  );
}

export const WikiAnchor = memo(WikiAnchorBase);
export default WikiAnchor;
