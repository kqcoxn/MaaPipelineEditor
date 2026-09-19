import { useRef } from "react";
import { animate } from "motion/mini";
import { useAmbientMotion } from "../lib/useAmbientMotion";
import { BackgroundWallpaper } from "./BackgroundWallpaper";

// Sample a smooth orbit for native playback. Linear interpolation along these
// points keeps the camera moving instead of easing to a stop at every waypoint.
const cameraOrbit = Array.from({ length: 65 }, (_, index) => {
  const angle = (index === 64 ? 0 : index / 64) * Math.PI * 2;
  const x = Math.sin(angle) * 1.2;
  const y = -Math.cos(angle) * 0.8;
  const scale = 1.06 + Math.sin(angle) * 0.012;
  return `translate(${x}%, ${y}%) scale(${scale})`;
});

function createAmbience(element: HTMLDivElement) {
  const wallpaper = element.querySelector<HTMLElement>(".ambient-wallpaper")!;
  const light = element.querySelector<HTMLElement>(".ambient-light")!;
  return [
    animate(
      wallpaper,
      {
        transform: cameraOrbit,
      },
      { duration: 20, repeat: Infinity, ease: "linear" },
    ),
    // A pre-softened gradient is composited by opacity, avoiding full-window blur.
    animate(
      light,
      {
        opacity: [0.18, 0.42, 0.18],
        transform: [
          "translate(-2%, 0%)",
          "translate(2%, -2%)",
          "translate(-2%, 0%)",
        ],
      },
      { duration: 8, repeat: Infinity, ease: "easeInOut" },
    ),
  ];
}

export function BackgroundAmbience({ src, animated }: { src: string; animated: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useAmbientMotion(ref, createAmbience, animated);
  return (
    <div ref={ref} className="background-ambience" data-src={src} data-animated={animated} aria-hidden="true">
      <div className="ambient-wallpaper">
        <BackgroundWallpaper src={src} />
      </div>
      <div className="ambient-light" />
    </div>
  );
}
