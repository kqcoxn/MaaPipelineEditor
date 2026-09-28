export const CHECK_CANCELLED = "已取消检测，可启动当前版本";
export const CHECK_TIMEOUT = "检测超时，可启动当前版本或稍后重试";

/** Stop waiting without allowing a late network response to resume installation. */
export function waitForCheck<T>(
  request: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new Error(CHECK_CANCELLED));
    if (signal.aborted) {
      void request.catch(() => {});
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    request.then(resolve, reject).finally(() =>
      signal.removeEventListener("abort", cancel),
    );
  });
}
