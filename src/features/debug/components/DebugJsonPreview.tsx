import { useMemo, type CSSProperties } from "react";
import ReactJsonView from "@microlink/react-json-view";

const jsonContainerStyle: CSSProperties = {
  maxHeight: 420,
  overflow: "auto",
  border: "1px solid rgba(5, 5, 5, 0.08)",
  borderRadius: 6,
  padding: 10,
  background: "#fbfcfe",
};

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 320,
  overflow: "auto",
  wordBreak: "break-word",
};

export function DebugJsonPreview({ value }: { value: unknown }) {
  const parsed = useMemo(() => parseJsonLikeValue(value), [value]);

  if (!parsed.json) {
    return <pre style={preStyle}>{String(parsed.value ?? "")}</pre>;
  }

  return (
    <div style={jsonContainerStyle}>
      <ReactJsonView
        src={parsed.value as object}
        collapsed={2}
        collapseStringsAfterLength={96}
        displayDataTypes={false}
        displayObjectSize
        enableClipboard={false}
        iconStyle="square"
        name={false}
      />
    </div>
  );
}

function parseJsonLikeValue(value: unknown): { json: boolean; value: unknown } {
  if (isJsonContainer(value)) return { json: true, value };
  if (typeof value !== "string") return { json: false, value };

  const trimmed = value.trim();
  if (!trimmed) return { json: false, value };

  try {
    const parsed = JSON.parse(trimmed);
    return isJsonContainer(parsed)
      ? { json: true, value: parsed }
      : { json: false, value };
  } catch {
    return { json: false, value };
  }
}

function isJsonContainer(value: unknown): value is object {
  return Boolean(value && typeof value === "object");
}
