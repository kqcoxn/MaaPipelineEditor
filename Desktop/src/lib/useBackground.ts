import { useEffect, useState } from "react";
import type { Settings } from "../types";

export const builtinBackgrounds = [
  { id: "cloud-harbor", label: "云海黄昏", src: "/backgrounds/cloud-harbor-v6.png" },
  { id: "block-workshop", label: "方块工坊", src: "/backgrounds/block-workshop.png" },
] as const;

export function useBackground(settings: Settings | undefined) {
  const mode = settings?.backgroundMode ?? "carousel";
  const custom = settings?.background ?? false;
  const [order] = useState(() => {
    const shuffled = [...builtinBackgrounds];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    return shuffled;
  });
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (mode !== "carousel" || custom) return;
    // Load the next wallpaper before its first turn to avoid an empty frame.
    const images = order.map(({ src }) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setCarouselIndex((index) => {
        const next = (index + 1) % builtinBackgrounds.length;
        return images[next].complete && images[next].naturalWidth > 0
          ? next
          : index;
      });
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [mode, custom, order]);

  if (mode === "fixed") return settings?.fixedBackground ?? "cloud-harbor";
  return order[mode === "carousel" ? carouselIndex : 0].id;
}
