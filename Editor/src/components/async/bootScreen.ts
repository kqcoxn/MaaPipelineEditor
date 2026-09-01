const BOOT_SCREEN_ID = "mpe-boot-screen";
const PRODUCTION_MIN_BOOT_SCREEN_VISIBLE_MS = 2_000;
const BOOT_SCREEN_EXIT_MS = 480;
const EXIT_FALLBACK_BUFFER_MS = 100;

interface BootScreenOptions {
  isDevelopment?: boolean;
}

interface BootScreenUpdate {
  detail: string;
  progress: number;
}

interface FinishBootScreenOptions extends BootScreenOptions {
  detail: string;
}

function normalizeProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

export function updateBootScreen({
  detail,
  progress,
}: BootScreenUpdate): void {
  const screen = document.getElementById(BOOT_SCREEN_ID);
  if (!screen || screen.dataset.dismissScheduled === "true") return;

  const detailElement = document.getElementById("mpe-boot-detail");
  const progressElement = document.getElementById("mpe-boot-progress");
  const percentElement = document.getElementById("mpe-boot-percent");
  const progressBar = progressElement?.parentElement;
  if (!detailElement || !progressElement || !percentElement || !progressBar) {
    return;
  }

  screen.dataset.runtimeOwned = "true";
  const currentProgress = normalizeProgress(
    Number(progressBar.getAttribute("aria-valuenow")),
  );
  const nextProgress = Math.max(currentProgress, normalizeProgress(progress));

  detailElement.textContent = detail;
  progressElement.style.width = `${nextProgress}%`;
  percentElement.textContent = `${nextProgress}%`;
  progressBar.setAttribute("aria-valuenow", String(nextProgress));
}

function waitForContentPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    const fallbackTimer = window.setTimeout(finish, 100);

    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.setTimeout(finish, 0)),
    );
  });
}

export async function finishBootScreenWhenReady({
  detail,
  isDevelopment = import.meta.env.DEV,
}: FinishBootScreenOptions): Promise<void> {
  updateBootScreen({ detail, progress: 96 });
  await waitForContentPaint();
  dismissBootScreenWhenReady({ isDevelopment });
}

export function dismissBootScreenWhenReady({
  isDevelopment = import.meta.env.DEV,
}: BootScreenOptions = {}): void {
  const screen = document.getElementById(BOOT_SCREEN_ID);
  if (!screen || screen.dataset.dismissScheduled === "true") return;
  screen.dataset.dismissScheduled = "true";

  const startedAt = Number(screen.dataset.startedAt);
  const elapsedMs = Number.isFinite(startedAt) ? Date.now() - startedAt : 0;
  const reduceMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const skipMotion = isDevelopment || reduceMotion;
  const minimumVisibleMs = isDevelopment
    ? 0
    : PRODUCTION_MIN_BOOT_SCREEN_VISIBLE_MS;
  const exitDurationMs = skipMotion ? 0 : BOOT_SCREEN_EXIT_MS;
  const exitDelayMs = Math.max(
    0,
    minimumVisibleMs - elapsedMs - exitDurationMs,
  );

  window.setTimeout(() => {
    if (skipMotion) {
      screen.remove();
      delete document.documentElement.dataset.mpeBootTheme;
      return;
    }

    let removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      screen.removeEventListener("animationend", handleAnimationEnd);
      screen.remove();
      delete document.documentElement.dataset.mpeBootTheme;
    }
    function handleAnimationEnd(event: AnimationEvent) {
      if (event.target === screen) remove();
    }
    screen.addEventListener("animationend", handleAnimationEnd);
    screen.classList.add("mpe-boot-screen--leaving");
    window.setTimeout(remove, BOOT_SCREEN_EXIT_MS + EXIT_FALLBACK_BUFFER_MS);
  }, exitDelayMs);
}
