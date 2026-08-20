import {
  Children,
  Component,
  isValidElement,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";
import { Mermaid } from "@ant-design/x";
import {
  XMarkdown,
  type ComponentProps as XMarkdownComponentProps,
} from "@ant-design/x-markdown";

import style from "../../../styles/panels/AIHistoryPanel.module.less";

export interface MarkdownBubbleContent {
  text: string;
  streaming?: boolean;
}

interface MarkdownCodeProps extends XMarkdownComponentProps {
  block?: boolean;
  lang?: string;
  children?: ReactNode;
}

interface MermaidRenderBoundaryProps {
  children: ReactNode;
  source: string;
}

interface MermaidRenderBoundaryState {
  failed: boolean;
}

const streamingMarkdownOptions = {
  hasNextChunk: true,
  tail: true,
} as const;

const mermaidConfig = {
  securityLevel: "strict",
  startOnLoad: false,
} as const;

const mermaidActions = {
  enableZoom: true,
  enableDownload: true,
  enableCopy: true,
} as const;

const mermaidClassNames = {
  root: style.mermaidRoot,
  graph: style.mermaidGraph,
  code: style.mermaidCode,
} as const;

function isMermaidLanguage(lang?: string): boolean {
  return lang?.trim().split(/\s+/, 1)[0]?.toLowerCase() === "mermaid";
}

function reactNodeToText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(reactNodeToText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return reactNodeToText(node.props.children);
  }
  return "";
}

class MermaidRenderBoundary extends Component<
  MermaidRenderBoundaryProps,
  MermaidRenderBoundaryState
> {
  state: MermaidRenderBoundaryState = { failed: false };

  static getDerivedStateFromError(): MermaidRenderBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("MPE Harness Mermaid 渲染失败:", error, errorInfo);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={style.mermaidFallback} role="alert">
        <span>流程图渲染失败，已显示源码。</span>
        <pre>
          <code>{this.props.source}</code>
        </pre>
      </div>
    );
  }
}

function MarkdownCode({
  block,
  lang,
  streamStatus,
  domNode: _domNode,
  children,
  className,
}: MarkdownCodeProps) {
  if (block && isMermaidLanguage(lang) && streamStatus === "done") {
    const source = reactNodeToText(children).replace(/\n$/, "");
    return (
      <section className={style.mermaidBlock} aria-label="Mermaid 流程图">
        <MermaidRenderBoundary key={source} source={source}>
          <Mermaid
            config={mermaidConfig}
            actions={mermaidActions}
            classNames={mermaidClassNames}
          >
            {source}
          </Mermaid>
        </MermaidRenderBoundary>
      </section>
    );
  }

  return <code className={className}>{children}</code>;
}

function MarkdownPre({
  domNode: _domNode,
  streamStatus: _streamStatus,
  children,
  className,
}: XMarkdownComponentProps) {
  const childItems = Children.toArray(children);
  const codeChild =
    childItems.length === 1 &&
    isValidElement<MarkdownCodeProps>(childItems[0])
      ? (childItems[0] as ReactElement<MarkdownCodeProps>)
      : undefined;
  const isCompletedMermaid =
    codeChild?.props.block &&
    codeChild.props.streamStatus === "done" &&
    isMermaidLanguage(codeChild.props.lang);

  if (isCompletedMermaid) return codeChild;
  return <pre className={className}>{children}</pre>;
}

const markdownComponents = {
  code: MarkdownCode,
  pre: MarkdownPre,
} as const;

export function renderMarkdown(content: MarkdownBubbleContent) {
  return (
    <XMarkdown
      content={content.text}
      components={markdownComponents}
      rootClassName={style.markdown}
      openLinksInNewTab
      escapeRawHtml
      streaming={content.streaming ? streamingMarkdownOptions : undefined}
    />
  );
}
