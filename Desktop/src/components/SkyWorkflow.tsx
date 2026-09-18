import { useRef } from "react";
import { useAmbientMotion } from "../lib/useAmbientMotion";
import { createSkyMotion } from "../lib/skyMotion";

// Decorative vector layer: stays separate from the reusable wallpaper.
const connections = [
  "M48 174 C92 174 76 100 126 100",
  "M48 174 C90 174 98 238 148 238",
  "M180 100 C236 100 216 48 272 48",
  "M180 100 C226 100 228 163 292 163",
  "M202 238 C250 238 244 177 292 177",
  "M326 48 C378 48 358 107 410 107",
  "M350 170 C380 170 380 119 410 119",
  "M350 170 C412 170 401 249 468 249",
  "M464 113 C510 113 492 177 546 177",
];
const nodes = [
  { x: 16, y: 157, w: 32, h: 34 },
  { x: 126, y: 82, w: 54, h: 36 },
  { x: 148, y: 220, w: 54, h: 36 },
  { x: 272, y: 30, w: 54, h: 36 },
  { x: 410, y: 95, w: 54, h: 36 },
  { x: 468, y: 231, w: 54, h: 36 },
  { x: 546, y: 159, w: 54, h: 36 },
];

export function SkyWorkflow({ animated = true }: { animated?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useAmbientMotion(ref, createSkyMotion, animated);
  return (
    <svg
      ref={ref}
      className="sky-workflow"
      viewBox="0 0 630 290"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="sky-flow-color"
          x1="20"
          y1="240"
          x2="590"
          y2="45"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffdcac" />
          <stop offset=".44" stopColor="#b5e3ff" />
          <stop offset="1" stopColor="#edf6ff" />
        </linearGradient>
        <linearGradient id="sky-node-fill" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#def0ff" stopOpacity=".26" />
          <stop offset="1" stopColor="#95c8ff" stopOpacity=".07" />
        </linearGradient>
        <filter id="sky-flow-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g className="sky-connections" stroke="url(#sky-flow-color)">
        <g strokeWidth="5" opacity=".45" filter="url(#sky-flow-glow)">
          {connections.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g strokeWidth="1.4">
          {connections.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <g stroke="#f0faff" strokeWidth="2.8" strokeLinecap="round">
        {connections.map((d) => (
          <path
            className="sky-signal"
            key={d}
            d={d}
            pathLength="1"
            strokeDasharray="0.045 0.955"
          />
        ))}
      </g>
      <g className="sky-nodes">
        {nodes.map(({ x, y, w, h }) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <rect
              width={w}
              height={h}
              rx="5"
              fill="url(#sky-node-fill)"
              stroke="#d2eaff"
              strokeOpacity=".85"
            />
            <rect
              width={w}
              height={h}
              rx="5"
              stroke="#a9d9ff"
              strokeWidth="3"
              opacity=".55"
              filter="url(#sky-flow-glow)"
            />
            <circle cx="9" cy="11" r="2" fill="#e0f1ff" />
            <path
              d={`M16 11 H${w - 8} M8 20 H${w - 9} M8 26 H${w - 18}`}
              stroke="#d7eaff"
              strokeOpacity=".7"
              strokeLinecap="round"
            />
          </g>
        ))}
        <g transform="translate(292 141)">
          <rect
            width="58"
            height="58"
            rx="10"
            fill="url(#sky-node-fill)"
            stroke="#d8efff"
            strokeWidth="1.5"
          />
          <rect
            width="58"
            height="58"
            rx="10"
            stroke="#9ad6ff"
            strokeWidth="5"
            opacity=".75"
            filter="url(#sky-flow-glow)"
          />
          <g
            stroke="#f0f8ff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 29 H23 M23 29 V15 H36 M23 29 H36 M23 29 V43 H36" />
            <circle cx="41" cy="15" r="4" />
            <circle cx="41" cy="29" r="4" />
            <circle cx="41" cy="43" r="4" />
          </g>
        </g>
      </g>
    </svg>
  );
}
