import { useMemo, type CSSProperties } from "react";
import { Button, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import ReactJsonView from "@microlink/react-json-view";

const jsonContainerStyle: CSSProperties = {
  maxHeight: 420,
  overflow: "auto",
  border: "1px solid rgba(5, 5, 5, 0.08)",
  borderRadius: 6,
  padding: 10,
  background: "#fbfcfe",
  userSelect: "text",
};

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 320,
  overflow: "auto",
  wordBreak: "break-word",
  userSelect: "text",
};

const copyBtnStyle: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  opacity: 0.7,
};

const containerWrapStyle: CSSProperties = {
  position: "relative",
};

export function DebugJsonPreview({ value }: { value: unknown }) {
  const { t } = useTranslation();
  const parsed = useMemo(() => parseJsonLikeValue(value), [value]);

  const fullText = parsed.json
    ? JSON.stringify(parsed.value, null, 2)
    : String(parsed.value ?? "");

  const copyAll = () => {
    navigator.clipboard.writeText(fullText).then(
      () => message.success(t("debug.common.copied", "已复制")),
      () => message.error(t("debug.common.copyFailed", "复制失败")),
    );
  };

  if (!parsed.json) {
    return (
      <div style={containerWrapStyle}>
        <Button
          size="small"
          icon={<CopyOutlined />}
          style={copyBtnStyle}
          onClick={copyAll}
        />
        <pre style={preStyle}>{String(parsed.value ?? "")}</pre>
      </div>
    );
  }

  return (
    <div style={{ ...jsonContainerStyle, ...containerWrapStyle }}>
      <Button
        size="small"
        icon={<CopyOutlined />}
        style={copyBtnStyle}
        onClick={copyAll}
      />
      <ReactJsonView
        src={parsed.value as object}
        collapsed={2}
        collapseStringsAfterLength={96}
        displayDataTypes={false}
        displayObjectSize
        enableClipboard
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
