/** Reveal after local first-screen assets settle, with a bounded wait and unmount cleanup. */
export function revealWhenReady(
  assets: Promise<unknown>,
  reveal: () => void,
  timeout = 1500,
): () => void {
  let disposed = false;
  let revealed = false;
  const finish = () => {
    if (disposed || revealed) return;
    revealed = true;
    clearTimeout(timer);
    reveal();
  };
  const timer = setTimeout(finish, timeout);
  // Hidden WebViews can suspend animation frames; don't await requestAnimationFrame.
  void assets.then(finish, finish);
  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}

export function prepareLauncherImages(): Promise<unknown> {
  const url = document.querySelector<HTMLElement>(".background-ambience")?.dataset.src;
  return Promise.allSettled(
    [url, "./logo.png"]
      .filter((src): src is string => Boolean(src))
      .map((src) => {
        const image = new Image();
        image.src = src;
        return image.decode();
      }),
  );
}
