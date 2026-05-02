import { useState } from "react";
import type { WikiContentBlock } from "../../../wiki/types";
import style from "./WikiMediaBlock.module.less";

type MediaBlock = Extract<WikiContentBlock, { type: "image" | "video" }>;
type MediaStatus = "loading" | "ready" | "error";

export function WikiMediaBlock({ block }: { block: MediaBlock }) {
  const [status, setStatus] = useState<MediaStatus>("loading");
  const aspectRatio = block.aspectRatio ?? "16 / 9";
  const progress = status === "ready" ? 100 : status === "error" ? 100 : 35;

  return (
    <figure className={style.mediaFigure}>
      <div className={style.mediaFrame} style={{ aspectRatio }}>
        {block.type === "image" ? (
          <img
            className={style.mediaElement}
            src={block.src}
            alt={block.alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        ) : (
          <video
            className={style.mediaElement}
            src={block.src}
            title={block.title}
            poster={block.poster}
            controls
            preload="metadata"
            onLoadedMetadata={() => setStatus("ready")}
            onCanPlay={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        )}
        {status !== "ready" && (
          <div className={style.mediaPlaceholder}>
            <span className={status === "error" ? style.mediaError : undefined}>
              {status === "error" ? "媒体加载失败" : "媒体加载中"}
            </span>
            <div className={style.mediaProgressTrack}>
              <div
                className={style.mediaProgressBar}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {block.caption && <figcaption className={style.caption}>{block.caption}</figcaption>}
    </figure>
  );
}
