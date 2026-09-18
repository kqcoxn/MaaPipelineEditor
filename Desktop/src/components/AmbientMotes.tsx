import { useRef } from "react";
import { animate } from "motion/mini";
import { useAmbientMotion } from "../lib/useAmbientMotion";

// Stable positions keep rerenders from randomly rearranging the scene.
const motes = [
  [43, 68, 3],
  [54, 47, 4],
  [61, 77, 3],
  [68, 61, 5],
  [77, 39, 3],
  [86, 68, 4],
  [93, 49, 3],
  [72, 23, 3],
  [58, 30, 3],
  [83, 81, 5],
  [48, 84, 3],
  [91, 29, 4],
];

function createMotes(element: HTMLDivElement) {
  return Array.from(element.children, (mote, index) =>
    animate(
      mote,
      {
        transform: [
          "translate(-6px, 18px) scale(0.7)",
          "translate(4px, -4px) scale(1)",
          "translate(-2px, -30px) scale(0.7)",
        ],
        opacity: [0, 0.75, 0],
      },
      {
        duration: 8 + (index % 4) * 1.5,
        delay: -index * 1.3,
        repeat: Infinity,
        ease: "linear",
      },
    ),
  );
}

export function AmbientMotes() {
  const ref = useRef<HTMLDivElement>(null);
  useAmbientMotion(ref, createMotes);
  return (
    <div ref={ref} className="ambient-motes" aria-hidden="true">
      {motes.map(([left, top, size], index) => (
        <span
          key={index}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
          }}
        />
      ))}
    </div>
  );
}
