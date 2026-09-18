import { useEffect, useReducer, useState, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { openLink } from "../model";
import type { LinkItem } from "../types";
import { homepageImage, reportCover } from "../lib/homepage";
import {
  carouselDuration,
  carouselTransition,
  slideKey,
} from "../lib/carousel";

const fallbackImage = reportCover;

function SlideImage({
  slide,
  layer,
  onReady,
  onFinish,
}: {
  slide: LinkItem;
  layer: "base" | "incoming" | "hidden";
  onReady: (key: string) => void;
  onFinish: (key: string) => void;
}) {
  const [src, setSrc] = useState(() => homepageImage(slide.image));
  const [failed, setFailed] = useState(false);
  const recover = () => {
    if (src !== fallbackImage) setSrc(fallbackImage);
    else setFailed(true);
  };
  return (
    <img
      className="carousel-image"
      data-layer={failed ? "hidden" : layer}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      onLoad={(event) => {
        const image = event.currentTarget;
        // Decode the actual mounted image before fading it in, not just a detached preloader.
        void image.decode().then(() => {
          if (image.isConnected) onReady(slideKey(slide));
        }, recover);
      }}
      onError={recover}
      onAnimationEnd={(event) => {
        if (layer === "incoming" && event.target === event.currentTarget)
          onFinish(slideKey(slide));
      }}
    />
  );
}

export function CarouselStory({
  slides,
  requested,
  reduced,
}: {
  slides: LinkItem[];
  requested: LinkItem;
  reduced: boolean;
}) {
  const [ready, setReady] = useState<Set<string>>(() => new Set());
  const [transition, dispatch] = useReducer(carouselTransition, {});
  const requestedKey = slideKey(requested);
  useEffect(() => {
    if (ready.has(requestedKey))
      dispatch({ type: "request", slide: requested, reduced });
  }, [ready, requestedKey, requested, reduced, transition.incoming]);
  useEffect(() => {
    if (!transition.incoming) return;
    const key = slideKey(transition.incoming);
    // Also settle when animationend isn't delivered (e.g. hidden WebView).
    const timer = setTimeout(
      () => dispatch({ type: "finish", key }),
      carouselDuration + 80,
    );
    return () => clearTimeout(timer);
  }, [transition.incoming]);
  const current = transition.incoming ?? transition.base ?? requested;
  const baseKey = transition.base && slideKey(transition.base);
  const incomingKey = transition.incoming && slideKey(transition.incoming);
  // Retain the visible image if remote content refreshes while replacement images load.
  const layers = [
    ...new Map(
      [
        ...slides,
        ...(transition.base ? [transition.base] : []),
        ...(transition.incoming ? [transition.incoming] : []),
      ].map((slide) => [slideKey(slide), slide]),
    ).values(),
  ];
  return (
    <button
      className="hero-story"
      aria-label={current.title}
      title={current.title}
      onClick={() => void openLink(current.url)}
    >
      <span
        className="carousel-images"
        style={
          { "--carousel-duration": `${carouselDuration}ms` } as CSSProperties
        }
      >
        {layers.map((slide) => (
          <SlideImage
            key={slideKey(slide)}
            slide={slide}
            layer={
              slideKey(slide) === incomingKey
                ? "incoming"
                : slideKey(slide) === baseKey
                  ? "base"
                  : "hidden"
            }
            onFinish={(key) => dispatch({ type: "finish", key })}
            onReady={(key) =>
              setReady((previous) =>
                previous.has(key) ? previous : new Set(previous).add(key),
              )
            }
          />
        ))}
        <span className="carousel-link-icon" aria-hidden="true">
          <ArrowUpRight size={14} />
        </span>
      </span>
    </button>
  );
}
