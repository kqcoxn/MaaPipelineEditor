import { isEmbedEnvironment, sendToParent } from "../../../utils/embedBridge";

function normalizeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function openExternalUrl(url: string): boolean {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return false;

  if (isEmbedEnvironment()) {
    sendToParent("mpe:openExternalRequest", { url: normalizedUrl });
    return true;
  }

  return (
    window.open(normalizedUrl, "_blank", "noopener,noreferrer") !== null
  );
}

export function registerEmbedExternalNavigation(): () => void {
  if (!isEmbedEnvironment()) return () => {};

  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.hasAttribute("download")) return;

    const normalizedUrl = normalizeExternalUrl(anchor.href);
    if (!normalizedUrl) return;

    event.preventDefault();
    sendToParent("mpe:openExternalRequest", { url: normalizedUrl });
  };

  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}
