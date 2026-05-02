import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import { Alert, Typography } from "antd";
import type { WikiCalloutType, WikiContentBlock } from "../../../wiki/types";
import { WikiMediaBlock } from "./WikiMediaBlock";

const { Paragraph } = Typography;

const markdownStyle: CSSProperties = {
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const codeBlockStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  overflowX: "auto",
  background: "#f6f8fa",
  border: "1px solid #f0f0f0",
  borderRadius: 8,
};

export function WikiBlock({ block }: { block: WikiContentBlock }) {
  switch (block.type) {
    case "paragraph":
      return <Paragraph style={{ margin: 0 }}>{block.text}</Paragraph>;
    case "markdown":
      return (
        <div style={markdownStyle}>
          <ReactMarkdown>{block.text}</ReactMarkdown>
        </div>
      );
    case "callout":
      return (
        <Alert
          type={toAlertType(block.calloutType)}
          showIcon
          message={block.title}
          description={block.text}
        />
      );
    case "code":
      return (
        <pre style={codeBlockStyle}>
          <code>{block.text}</code>
        </pre>
      );
    case "image":
    case "video":
      return <WikiMediaBlock block={block} />;
    case "component": {
      const Component = block.render;
      return <Component />;
    }
    default:
      return null;
  }
}

function toAlertType(type: WikiCalloutType | undefined) {
  return type ?? "info";
}
