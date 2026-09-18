import { useEffect, type RefObject } from "react";
import type { animate } from "motion/mini";

type Playback = ReturnType<typeof animate>;

/** Keep decorative loops out of React renders and suspend them off-screen. */
export function useAmbientMotion<T extends Element>(
  ref: RefObject<T | null>,
  create: (element: T) => Playback[],
  enabled = true,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animations: Playback[] = [];
    const cancel = () => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
    };
    const sync = () => {
      if (reduced.matches) {
        cancel();
        return;
      }
      // A visible Tauri WebView need not have document focus (including on show).
      // Scenery keeps moving while visible, even when the user is in another app.
      const active = !document.hidden;
      if (active && animations.length === 0) animations = create(element);
      animations.forEach((animation) =>
        active ? animation.play() : animation.pause(),
      );
    };
    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancel();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref, create, enabled]);
}
