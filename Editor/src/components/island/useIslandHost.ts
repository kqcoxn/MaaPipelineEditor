import { useEffect, useState } from "react";

export const ISLAND_HOST_ID = "mpe-island-host";

/**画布顶部灵动胶囊宿主，调试与成就共用同一纵向栈 */
export function useIslandHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(() =>
    document.getElementById(ISLAND_HOST_ID),
  );

  useEffect(() => {
    if (host) return;
    const found = document.getElementById(ISLAND_HOST_ID);
    if (found) {
      setHost(found);
      return;
    }
    const observer = new MutationObserver(() => {
      const next = document.getElementById(ISLAND_HOST_ID);
      if (next) {
        setHost(next);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [host]);

  return host;
}
