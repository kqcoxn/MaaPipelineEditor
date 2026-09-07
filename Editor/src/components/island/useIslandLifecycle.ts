import { useCallback, useEffect, useRef, useState } from "react";

import { ISLAND_EXIT_MS } from "./types";
import type { IslandAutoHide, IslandController } from "./types";

export interface IslandLifecycle extends IslandController {
  setHovered: (hovered: boolean) => void;
  setFocused: (focused: boolean) => void;
}

export function useIslandLifecycle(
  identity: string | undefined,
  autoHide?: IslandAutoHide,
  onHidden?: () => void,
): IslandLifecycle {
  const [expanded, setExpandedState] = useState(false);
  const [visualExpanded, setVisualExpanded] = useState(false);
  const [detailsMounted, setDetailsMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    setExpandedState(false);
    setVisualExpanded(false);
    setDetailsMounted(false);
    setHovered(false);
    setFocused(false);
    setExiting(false);
    setHidden(false);
  }, [identity]);

  useEffect(() => {
    if (expanded) {
      setDetailsMounted(true);
      let revealFrame = 0;
      const mountFrame = requestAnimationFrame(() => {
        revealFrame = requestAnimationFrame(() => setVisualExpanded(true));
      });
      return () => {
        cancelAnimationFrame(mountFrame);
        cancelAnimationFrame(revealFrame);
      };
    }
    setVisualExpanded(false);
    const timer = setTimeout(() => setDetailsMounted(false), 500);
    return () => clearTimeout(timer);
  }, [expanded]);

  const autoHideEnabled = autoHide?.enabled ?? false;
  const durationMs = autoHide?.durationMs ?? 0;
  const pauseWhenExpanded = autoHide?.pauseWhenExpanded ?? false;

  useEffect(() => {
    setExiting(false);
    if (!autoHideEnabled || hovered || focused) return;
    if (pauseWhenExpanded && expanded) return;
    const exitTimer = setTimeout(() => setExiting(true), durationMs);
    const hideTimer = setTimeout(() => {
      setHidden(true);
      onHiddenRef.current?.();
    }, durationMs + ISLAND_EXIT_MS);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [identity, autoHideEnabled, durationMs, pauseWhenExpanded, hovered, focused, expanded]);

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpandedState((current) => !current);
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    onHiddenRef.current?.();
  }, []);

  return {
    expanded,
    visualExpanded,
    detailsMounted,
    hovered,
    focused,
    exiting,
    hidden,
    setExpanded,
    toggleExpanded,
    dismiss,
    setHovered,
    setFocused,
  };
}
