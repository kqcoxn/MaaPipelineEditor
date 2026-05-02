import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import type { TooltipProps } from "antd";
import { useWikiStore } from "../../../stores/wikiStore";
import { isWikiTargetAvailable } from "../../../wiki/registry";
import type { WikiTarget } from "../../../wiki/types";
import style from "./WikiPonderTrigger.module.less";

const HOLD_DURATION_MS = 600;

type TooltipPlacement = NonNullable<TooltipProps["placement"]>;

export interface WikiPonderTriggerProps {
  target: WikiTarget;
  title: string;
  description: string;
  placement?: TooltipPlacement;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface UseWikiHoldHotkeyOptions {
  enabled: boolean;
  onComplete: () => void;
  onProgressChange: (progress: number) => void;
}

function isEditableHotkeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  return Boolean(target.closest(".monaco-editor"));
}

function useWikiHoldHotkey({
  enabled,
  onComplete,
  onProgressChange,
}: UseWikiHoldHotkeyOptions) {
  const timerRef = useRef<number | undefined>();
  const frameRef = useRef<number | undefined>();
  const startedAtRef = useRef(0);
  const holdingRef = useRef(false);

  const clearHold = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (frameRef.current !== undefined) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    startedAtRef.current = 0;
    holdingRef.current = false;
    onProgressChange(0);
  }, [onProgressChange]);

  const updateProgress = useCallback(() => {
    if (!holdingRef.current) return;
    const elapsed = window.performance.now() - startedAtRef.current;
    onProgressChange(Math.min(elapsed / HOLD_DURATION_MS, 1));
    frameRef.current = window.requestAnimationFrame(updateProgress);
  }, [onProgressChange]);

  useEffect(() => {
    if (!enabled) {
      clearHold();
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "w") return;
      if (event.repeat || holdingRef.current) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.isComposing || isEditableHotkeyTarget(event.target)) return;

      startedAtRef.current = window.performance.now();
      holdingRef.current = true;
      onProgressChange(0);
      frameRef.current = window.requestAnimationFrame(updateProgress);
      timerRef.current = window.setTimeout(() => {
        clearHold();
        onComplete();
      }, HOLD_DURATION_MS);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "w") {
        clearHold();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      clearHold();
    };
  }, [clearHold, enabled, onComplete, onProgressChange, updateProgress]);
}

export function WikiPonderTrigger({
  target,
  title,
  description,
  placement = "top",
  disabled = false,
  icon,
  className,
  style: triggerStyle,
}: WikiPonderTriggerProps) {
  const openWiki = useWikiStore((state) => state.openWiki);
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const available = !disabled && isWikiTargetAvailable(target);
  const targetSignature = `${target.entryId}/${target.moduleId ?? ""}/${
    target.stepId ?? ""
  }`;

  useEffect(() => {
    if (!disabled && !available) {
      console.warn("[WikiPonderTrigger] Unknown wiki target:", targetSignature);
    }
  }, [available, disabled, targetSignature]);

  const openTarget = useCallback(() => {
    if (!available) return;
    openWiki(target);
  }, [available, openWiki, target]);

  useWikiHoldHotkey({
    enabled: active && available,
    onComplete: openTarget,
    onProgressChange: setProgress,
  });

  const tooltipTitle = useMemo(
    () => (
      <div className={style.tooltipContent}>
        <div className={style.tooltipTitle}>
          {available ? title : "Wiki 内容待补充"}
        </div>
        <div className={style.tooltipDescription}>
          {available ? description : "当前入口尚未配置可跳转的 Wiki 内容。"}
        </div>
        <div className={style.tooltipHint}>
          {available ? "按住 W 思索" : "请补充有效 Wiki Target"}
        </div>
        {progress > 0 && (
          <div className={style.progressTrack}>
            <div
              className={style.progressBar}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    ),
    [available, description, progress, title],
  );

  return (
    <Tooltip
      title={tooltipTitle}
      placement={placement}
      destroyOnHidden
      open={active || progress > 0}
    >
      <button
        type="button"
        className={[style.trigger, !available && style.unavailable, className]
          .filter(Boolean)
          .join(" ")}
        style={triggerStyle}
        aria-disabled={!available}
        aria-label={`${title} Wiki`}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {icon ?? <QuestionCircleOutlined />}
      </button>
    </Tooltip>
  );
}
