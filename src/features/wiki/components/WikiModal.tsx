import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  Button,
  Empty,
  Modal,
  Segmented,
  Skeleton,
  Space,
  Typography,
} from "antd";
import {
  BookOutlined,
  HomeOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import {
  wikiEntries,
  findWikiEntry,
  findWikiModuleMeta,
} from "../../../wiki/registry";
import type {
  WikiCalloutType,
  WikiContentBlock,
  WikiEntryMeta,
  WikiModule,
  WikiTarget,
} from "../../../wiki/types";
import { useWikiStore } from "../../../stores/wikiStore";

const { Paragraph, Text, Title } = Typography;

const modalBodyStyle: CSSProperties = {
  height: "clamp(560px, calc(100vh - 200px), 720px)",
  minHeight: 560,
  display: "flex",
  overflow: "hidden",
  background: "var(--ant-color-bg-container)",
};

const catalogStyle: CSSProperties = {
  width: 248,
  flexShrink: 0,
  padding: "18px 14px 18px 18px",
  borderRight: "1px solid rgba(5, 5, 5, 0.08)",
  overflowY: "auto",
};

const mainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  padding: "18px 22px 20px",
  overflow: "hidden",
};

const readerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  padding: 18,
  border: "1px solid rgba(5, 5, 5, 0.08)",
  borderRadius: 8,
  background: "var(--ant-color-bg-container)",
  overflow: "hidden",
  position: "relative",
};

const stepBodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 4,
  scrollbarGutter: "stable",
};

const homeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const catalogButtonStyle: CSSProperties = {
  width: "100%",
  height: "auto",
  justifyContent: "flex-start",
  textAlign: "left",
  padding: "10px 12px",
  whiteSpace: "normal",
  borderLeft: "3px solid transparent",
  color: "var(--ant-color-text-secondary)",
};

const activeCatalogButtonStyle: CSSProperties = {
  ...catalogButtonStyle,
  borderLeftColor: "var(--ant-color-primary)",
  background: "rgba(22, 119, 255, 0.08)",
  color: "var(--ant-color-primary)",
};

const markdownStyle: CSSProperties = {
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const moduleTabListStyle: CSSProperties = {
  width: "fit-content",
  maxWidth: "100%",
};

export function WikiModal() {
  const {
    modalOpen,
    activeTarget,
    moduleCache,
    closeWiki,
    showHome,
    setTarget,
    loadModule,
  } = useWikiStore();
  const activeEntry = findWikiEntry(activeTarget?.entryId);
  const activeModuleMeta = findWikiModuleMeta(
    activeTarget?.entryId,
    activeTarget?.moduleId,
  );
  const activeModuleKey =
    activeEntry && activeModuleMeta
      ? `${activeEntry.id}/${activeModuleMeta.id}`
      : undefined;
  const activeModuleState = activeModuleKey
    ? moduleCache[activeModuleKey]
    : undefined;
  const activeModule = activeModuleState?.module;
  const activeStep = useMemo(
    () => getActiveStep(activeModule, activeTarget?.stepId),
    [activeModule, activeTarget?.stepId],
  );
  const activeStepIndex = activeModule?.steps.findIndex(
    (step) => step.id === activeStep?.id,
  );

  useEffect(() => {
    if (!modalOpen || !activeEntry || !activeModuleMeta) return;
    void loadModule(activeEntry.id, activeModuleMeta.id);
  }, [activeEntry, activeModuleMeta, loadModule, modalOpen]);

  return (
    <Modal
      title={
        <Space size={8}>
          <BookOutlined />
          <span>MPE Wiki / 俺寻思</span>
        </Space>
      }
      open={modalOpen}
      onCancel={closeWiki}
      footer={null}
      width="min(1180px, calc(100vw - 48px))"
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      <div style={modalBodyStyle}>
        <WikiCatalog
          activeTarget={activeTarget}
          onHome={showHome}
          onSelectEntry={(entry) => {
            setTarget({
              entryId: entry.id,
              moduleId: entry.modules[0]?.id,
            });
          }}
        />
        <main style={mainStyle}>
          {!activeEntry ? (
            <WikiHome onSelectEntry={(entry) => {
              setTarget({
                entryId: entry.id,
                moduleId: entry.modules[0]?.id,
              });
            }} />
          ) : (
            <WikiEntryReader
              entry={activeEntry}
              module={activeModule}
              moduleStatus={activeModuleState?.status ?? "idle"}
              moduleError={activeModuleState?.error}
              activeModuleId={activeModuleMeta?.id}
              activeStepId={activeStep?.id}
              activeStepIndex={activeStepIndex ?? -1}
              onSelectTarget={setTarget}
            />
          )}
        </main>
      </div>
    </Modal>
  );
}

function WikiCatalog({
  activeTarget,
  onHome,
  onSelectEntry,
}: {
  activeTarget?: WikiTarget;
  onHome: () => void;
  onSelectEntry: (entry: WikiEntryMeta) => void;
}) {
  return (
    <aside style={catalogStyle}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div>
          <Text type="secondary">按住 W 思索</Text>
          <Title level={4} style={{ margin: "4px 0 0" }}>
            知识目录
          </Title>
        </div>
        <Button
          type="text"
          icon={<HomeOutlined />}
          style={!activeTarget ? activeCatalogButtonStyle : catalogButtonStyle}
          onClick={onHome}
        >
          Wiki 首页
        </Button>
        {wikiEntries.map((entry) => (
          <Button
            key={entry.id}
            type="text"
            style={
              activeTarget?.entryId === entry.id
                ? activeCatalogButtonStyle
                : catalogButtonStyle
            }
            onClick={() => onSelectEntry(entry)}
          >
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <span>{entry.title}</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {entry.summary}
              </Text>
            </Space>
          </Button>
        ))}
      </Space>
    </aside>
  );
}

function WikiHome({
  onSelectEntry,
}: {
  onSelectEntry: (entry: WikiEntryMeta) => void;
}) {
  return (
    <Space direction="vertical" size={18} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ margin: "0 0 6px" }}>
          知识总览
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          内置在 MPE 里的交互式百科。P1 先提供基础阅读器和示例条目，后续会接入上下文帮助、搜索和动态图文教程。
        </Paragraph>
      </div>
      <div style={homeGridStyle}>
        {wikiEntries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            style={homeCardStyle}
            onClick={() => onSelectEntry(entry)}
          >
            <span style={homeCardTitleStyle}>{entry.title}</span>
            <span style={homeCardSummaryStyle}>{entry.summary}</span>
            <span style={homeCardMetaStyle}>
              {entry.modules.length} 个模块
            </span>
          </button>
        ))}
      </div>
    </Space>
  );
}

function WikiEntryReader({
  entry,
  module,
  moduleStatus,
  moduleError,
  activeModuleId,
  activeStepId,
  activeStepIndex,
  onSelectTarget,
}: {
  entry: WikiEntryMeta;
  module?: WikiModule;
  moduleStatus: "idle" | "loading" | "ready" | "error";
  moduleError?: string;
  activeModuleId?: string;
  activeStepId?: string;
  activeStepIndex: number;
  onSelectTarget: (target: WikiTarget) => void;
}) {
  const step = getActiveStep(module, activeStepId);
  const stepCount = module?.steps.length ?? 0;
  const currentIndex = activeStepIndex >= 0 ? activeStepIndex : 0;

  return (
    <Space
      direction="vertical"
      size={14}
      style={{ width: "100%", minHeight: 0, flex: 1 }}
    >
      <div>
        <Title level={3} style={{ margin: "0 0 6px" }}>
          {entry.title}
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {entry.summary}
        </Paragraph>
      </div>
      <Segmented
        aria-label="Wiki 模块"
        value={activeModuleId}
        options={entry.modules.map((item) => ({
          label: item.title,
          value: item.id,
        }))}
        style={moduleTabListStyle}
        onChange={(moduleId) => {
          onSelectTarget({
            entryId: entry.id,
            moduleId,
          });
        }}
      />
      <section style={readerStyle}>
        {moduleStatus === "loading" || moduleStatus === "idle" ? (
          <Skeleton active paragraph={{ rows: 7 }} />
        ) : moduleStatus === "error" ? (
          <Alert
            type="error"
            showIcon
            message="Wiki 模块加载失败"
            description={moduleError}
          />
        ) : !module || !step ? (
          <Empty description="当前模块暂无步骤" />
        ) : (
          <>
            <SidePager
              direction="previous"
              disabled={currentIndex <= 0}
              onClick={() => {
                const previousStep = module.steps[currentIndex - 1];
                if (!previousStep) return;
                onSelectTarget({
                  entryId: entry.id,
                  moduleId: module.id,
                  stepId: previousStep.id,
                });
              }}
            />
            <SidePager
              direction="next"
              disabled={currentIndex >= stepCount - 1}
              onClick={() => {
                const nextStep = module.steps[currentIndex + 1];
                if (!nextStep) return;
                onSelectTarget({
                  entryId: entry.id,
                  moduleId: module.id,
                  stepId: nextStep.id,
                });
              }}
            />
            <div style={{ marginBottom: 12 }}>
              <Title level={4} style={{ margin: "0 0 4px" }}>
                {step.title}
              </Title>
              {step.summary && (
                <Text type="secondary">{step.summary}</Text>
              )}
            </div>
            <div style={stepBodyStyle}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {step.blocks.map((block, index) => (
                  <WikiBlock key={`${block.type}-${index}`} block={block} />
                ))}
              </Space>
            </div>
            <StepPager
              entryId={entry.id}
              moduleId={module.id}
              steps={module.steps}
              currentIndex={currentIndex}
              onSelectTarget={onSelectTarget}
            />
          </>
        )}
      </section>
    </Space>
  );
}

function WikiBlock({ block }: { block: WikiContentBlock }) {
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
      return (
        <figure style={mediaFigureStyle}>
          <img
            src={block.src}
            alt={block.alt}
            loading="lazy"
            decoding="async"
            style={{
              ...mediaStyle,
              aspectRatio: block.aspectRatio ?? "16 / 9",
            }}
          />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case "video":
      return (
        <figure style={mediaFigureStyle}>
          <video
            src={block.src}
            title={block.title}
            poster={block.poster}
            controls
            preload="metadata"
            style={{
              ...mediaStyle,
              aspectRatio: block.aspectRatio ?? "16 / 9",
            }}
          />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case "component": {
      const Component = block.render;
      return <Component />;
    }
    default:
      return null;
  }
}

function StepPager({
  entryId,
  moduleId,
  steps,
  currentIndex,
  onSelectTarget,
}: {
  entryId: string;
  moduleId: string;
  steps: WikiModule["steps"];
  currentIndex: number;
  onSelectTarget: (target: WikiTarget) => void;
}) {
  return (
    <div style={pagerStyle}>
      <Space size={4} wrap>
        {steps.map((step, index) => (
          <Button
            key={step.id}
            size="small"
            shape="circle"
            type={index === currentIndex ? "primary" : "default"}
            style={stepNumberButtonStyle}
            onClick={() =>
              onSelectTarget({
                entryId,
                moduleId,
                stepId: step.id,
              })
            }
          >
            {index + 1}
          </Button>
        ))}
      </Space>
    </div>
  );
}

function SidePager({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={direction === "previous" ? "上一步" : "下一步"}
      shape="circle"
      icon={direction === "previous" ? <LeftOutlined /> : <RightOutlined />}
      disabled={disabled}
      style={{
        ...sidePagerButtonStyle,
        [direction === "previous" ? "left" : "right"]: 12,
      }}
      onClick={onClick}
    />
  );
}

function getActiveStep(module?: WikiModule, stepId?: string) {
  if (!module) return undefined;
  return (
    (stepId ? module.steps.find((step) => step.id === stepId) : undefined) ??
    module.steps[0]
  );
}

function toAlertType(type: WikiCalloutType | undefined) {
  return type ?? "info";
}

const homeCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 148,
  padding: 16,
  textAlign: "left",
  color: "inherit",
  background: "var(--ant-color-bg-container)",
  border: "1px solid rgba(5, 5, 5, 0.08)",
  borderRadius: 8,
  cursor: "pointer",
};

const homeCardTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
};

const homeCardSummaryStyle: CSSProperties = {
  color: "#595959",
  lineHeight: 1.55,
};

const homeCardMetaStyle: CSSProperties = {
  marginTop: "auto",
  color: "#8c8c8c",
  fontSize: 13,
};

const codeBlockStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  overflowX: "auto",
  background: "#f6f8fa",
  border: "1px solid #f0f0f0",
  borderRadius: 8,
};

const mediaFigureStyle: CSSProperties = {
  margin: 0,
};

const mediaStyle: CSSProperties = {
  width: "100%",
  maxHeight: 420,
  objectFit: "contain",
  background: "#f5f5f5",
  border: "1px solid #f0f0f0",
  borderRadius: 8,
};

const pagerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingTop: 10,
  marginTop: 10,
  borderTop: "1px solid rgba(5, 5, 5, 0.08)",
};

const sidePagerButtonStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 1,
};

const stepNumberButtonStyle: CSSProperties = {
  minWidth: 24,
  width: 24,
  height: 24,
  padding: 0,
};
