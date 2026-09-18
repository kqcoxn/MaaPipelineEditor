import { animate } from "motion/mini";

export function createSkyMotion(element: SVGSVGElement) {
  return [
    animate(
      element,
      {
        transform: [
          "translate(0px, 0px) rotate(0deg)",
          "translate(3px, -5px) rotate(0.3deg)",
          "translate(-2px, 2px) rotate(-0.2deg)",
          "translate(0px, 0px) rotate(0deg)",
        ],
      },
      { duration: 21, repeat: Infinity, ease: "easeInOut" },
    ),
    animate(
      element,
      {
        filter: [
          "blur(0px)",
          "blur(0px)",
          "blur(1.4px)",
          "blur(0px)",
          "blur(0px)",
        ],
        opacity: [0.95, 0.95, 0.72, 0.95, 0.95],
      },
      {
        duration: 10,
        times: [0, 0.15, 0.35, 0.55, 1],
        repeat: Infinity,
        ease: "easeInOut",
      },
    ),
    animate(
      element.querySelector(".sky-nodes")!,
      {
        opacity: [0.7, 1, 0.7],
      },
      { duration: 5, repeat: Infinity, ease: "easeInOut" },
    ),
    ...Array.from(
      element.querySelectorAll<SVGPathElement>(".sky-signal"),
      (path, index) =>
        animate(
          path,
          {
            strokeDashoffset: [0, -1],
            opacity: [0, 0.9, 0.9, 0],
          },
          {
            duration: 4.5 + (index % 3) * 0.6,
            delay: -index * 0.7,
            repeat: Infinity,
            ease: "linear",
          },
        ),
    ),
  ];
}
