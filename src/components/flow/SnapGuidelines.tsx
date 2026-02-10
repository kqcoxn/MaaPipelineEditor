import { memo } from "react";
import { useViewport } from "@xyflow/react";
import type { SnapGuideline } from "../../core/snapUtils";

const SnapGuidelines = memo(
  ({ guidelines }: { guidelines: SnapGuideline[] }) => {
    const { x, y, zoom } = useViewport();

    if (guidelines.length === 0) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1000,
          overflow: "hidden",
        }}
      >
        {guidelines.map((line, i) =>
          line.type === "vertical" ? (
            <div
              key={`v-${i}`}
              style={{
                position: "absolute",
                left: line.position * zoom + x,
                top: 0,
                width: "1.5px",
                height: "100%",
                background:
                  "repeating-linear-gradient(to bottom, #6366F1 0px, #6366F1 8px, transparent 8px, transparent 11px)",
              }}
            />
          ) : (
            <div
              key={`h-${i}`}
              style={{
                position: "absolute",
                top: line.position * zoom + y,
                left: 0,
                height: "1.5px",
                width: "100%",
                background:
                  "repeating-linear-gradient(to right, #6366F1 0px, #6366F1 8px, transparent 8px, transparent 11px)",
              }}
            />
          )
        )}
      </div>
    );
  }
);

export default SnapGuidelines;
