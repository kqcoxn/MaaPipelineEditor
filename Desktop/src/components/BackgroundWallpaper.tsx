import { useEffect, useState } from "react";

const fadeDuration = 900;

/** Keep the old image opaque until its decoded replacement has faded in. */
export function BackgroundWallpaper({ src }: { src: string }) {
  const [base, setBase] = useState<string>();
  const [incoming, setIncoming] = useState<string>();

  useEffect(() => {
    if (incoming || src === base) return;
    let cancelled = false;
    const image = new Image();
    image.src = src;
    void image.decode().then(() => {
      if (cancelled) return;
      if (!base || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        setBase(src);
      else setIncoming(src);
    }).catch(() => {
      // Leave the last usable background visible if the replacement fails.
    });
    return () => { cancelled = true; };
  }, [src, base, incoming]);

  useEffect(() => {
    if (!incoming) return;
    // Settle even if animationend is skipped while the WebView is hidden.
    const timer = window.setTimeout(() => {
      setBase(incoming);
      setIncoming(undefined);
    }, fadeDuration + 80);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  return (
    <>
      {[base, incoming].filter((image): image is string => !!image).map((image) => (
        <img
          key={image}
          className="background-image"
          data-incoming={image === incoming}
          src={image}
          alt=""
          draggable={false}
          onAnimationEnd={() => {
            if (image !== incoming) return;
            setBase(image);
            setIncoming(undefined);
          }}
          style={{ animationDuration: `${fadeDuration}ms` }}
        />
      ))}
    </>
  );
}
