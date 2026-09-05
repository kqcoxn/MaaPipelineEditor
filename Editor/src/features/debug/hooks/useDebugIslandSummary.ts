import { useEffect, useRef, useState } from "react";

interface IslandSummary {
  key: string;
  title: string;
  owner: string;
  subtitle: string;
}

const SUMMARY_WINDOW_MS = 300;

/** 合并窗口内的阶段变化，窗口结束只显示最新状态，不回放中间事件。 */
export function useDebugIslandSummary(current: IslandSummary, immediate: boolean) {
  const latest = useRef(current);
  const [displayed, setDisplayed] = useState(current);
  const pending = displayed.key !== current.key;

  useEffect(() => {
    latest.current = current;
  }, [current]);

  useEffect(() => {
    if (immediate) {
      setDisplayed(latest.current);
      return;
    }
    if (!pending) return;
    const timer = setTimeout(() => setDisplayed(latest.current), SUMMARY_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [pending, immediate, displayed.key]);

  // 同一操作的耗时和轮次保持实时，停止和终态不受显示节流影响。
  return immediate || !pending ? current : displayed;
}
