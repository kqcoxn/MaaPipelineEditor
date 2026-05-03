import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  message,
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
  LinkOutlined,
  RightOutlined,
} from "@ant-design/icons";
import {
  wikiEntries,
  findWikiEntry,
  findWikiModuleMeta,
} from "../../../wiki/registry";
import { searchWiki } from "../../../wiki/searchIndex";
import type {
  WikiEntryMeta,
  WikiModule,
  WikiTarget,
} from "../../../wiki/types";
import { useWikiStore } from "../../../stores/wikiStore";
import { createWikiShareUrl } from "../../../wiki/wikiUrl";
import { WikiBlock } from "./WikiBlock";
import { WikiSearchBox } from "./WikiSearchBox";
import style from "./WikiModal.module.less";

const { Paragraph, Text, Title } = Typography;

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
  borderLeftWidth: 3,
  borderLeftStyle: "solid",
  borderLeftColor: "transparent",
  color: "var(--ant-color-text-secondary)",
};

const activeCatalogButtonStyle: CSSProperties = {
  ...catalogButtonStyle,
  borderLeftColor: "var(--ant-color-primary)",
  background: "rgba(22, 119, 255, 0.08)",
  color: "var(--ant-color-primary)",
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
  const [searchText, setSearchText] = useState("");
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
  const searchResults = useMemo(() => searchWiki(searchText), [searchText]);
  const searching = searchText.trim().length > 0;
  const shareTarget = useMemo(
    () =>
      activeEntry
        ? {
            entryId: activeEntry.id,
            moduleId: activeModuleMeta?.id,
            stepId: activeStep?.id ?? activeTarget?.stepId,
          }
        : undefined,
    [
      activeEntry,
      activeModuleMeta?.id,
      activeStep?.id,
      activeTarget?.stepId,
    ],
  );

  useEffect(() => {
    if (!modalOpen || !activeEntry || !activeModuleMeta) return;
    void loadModule(activeEntry.id, activeModuleMeta.id);
  }, [activeEntry, activeModuleMeta, loadModule, modalOpen]);

  const handleCopyShareUrl = useCallback(() => {
    if (!shareTarget) return;
    const url = createWikiShareUrl(shareTarget);
    if (!navigator.clipboard?.writeText) {
      window.prompt("请手动复制 Wiki 链接", url);
      return;
    }
    void navigator.clipboard
      .writeText(url)
      .then(() => message.success("已复制 Wiki 链接"))
      .catch(() => {
        window.prompt("请手动复制 Wiki 链接", url);
      });
  }, [shareTarget]);

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
      <div className={style.modalBody}>
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
        <main className={style.main}>
          <div
            className={`${style.searchArea} ${
              searching ? style.activeSearchArea : ""
            }`}
          >
            <WikiSearchBox
              value={searchText}
              results={searchResults}
              onChange={setSearchText}
              onSelectTarget={(target) => {
                setTarget(target);
                setSearchText("");
              }}
            />
          </div>
          {searching ? null : !activeEntry ? (
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
              modalOpen={modalOpen}
              onSelectTarget={setTarget}
              onShare={handleCopyShareUrl}
              shareDisabled={!shareTarget}
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
    <aside className={style.catalog}>
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
          内置在 MPE 里的交互式操作百科。P1 已覆盖基础编辑、工具箱、调试、导入迁移与 LocalBridge 基础说明；后续会继续扩到 AI、迁移补全和更完整的图文内容。
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
  modalOpen,
  onSelectTarget,
  onShare,
  shareDisabled,
}: {
  entry: WikiEntryMeta;
  module?: WikiModule;
  moduleStatus: "idle" | "loading" | "ready" | "error";
  moduleError?: string;
  activeModuleId?: string;
  activeStepId?: string;
  activeStepIndex: number;
  modalOpen: boolean;
  onSelectTarget: (target: WikiTarget) => void;
  onShare: () => void;
  shareDisabled: boolean;
}) {
  const step = getActiveStep(module, activeStepId);
  const stepCount = module?.steps.length ?? 0;
  const currentIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const goToPreviousStep = useCallback(() => {
    const previousStep = module?.steps[currentIndex - 1];
    if (!previousStep || !module) return;
    onSelectTarget({
      entryId: entry.id,
      moduleId: module.id,
      stepId: previousStep.id,
    });
  }, [currentIndex, entry.id, module, onSelectTarget]);
  const goToNextStep = useCallback(() => {
    const nextStep = module?.steps[currentIndex + 1];
    if (!nextStep || !module) return;
    onSelectTarget({
      entryId: entry.id,
      moduleId: module.id,
      stepId: nextStep.id,
    });
  }, [currentIndex, entry.id, module, onSelectTarget]);

  useEffect(() => {
    if (!modalOpen || !module || stepCount <= 1) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isReaderHotkeyIgnoredTarget(event.target)) return;
      if (event.key === "ArrowLeft" && currentIndex > 0) {
        event.preventDefault();
        goToPreviousStep();
      }
      if (event.key === "ArrowRight" && currentIndex < stepCount - 1) {
        event.preventDefault();
        goToNextStep();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    currentIndex,
    goToNextStep,
    goToPreviousStep,
    modalOpen,
    module,
    stepCount,
  ]);

  return (
    <Space
      direction="vertical"
      size={14}
      style={{ width: "100%", minHeight: 0, flex: 1 }}
    >
      <div className={style.titleBar}>
        <div className={style.titleText}>
          <Title level={3} style={{ margin: "0 0 6px" }}>
            {entry.title}
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {entry.summary}
          </Paragraph>
        </div>
        <Button
          type="text"
          icon={<LinkOutlined />}
          disabled={shareDisabled}
          onClick={onShare}
        >
          分享
        </Button>
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
      <section className={style.reader}>
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
              onClick={goToPreviousStep}
            />
            <SidePager
              direction="next"
              disabled={currentIndex >= stepCount - 1}
              onClick={goToNextStep}
            />
            <div style={{ marginBottom: 12 }}>
              <Title level={4} style={{ margin: "0 0 4px" }}>
                {step.title}
              </Title>
              {step.summary && (
                <Text type="secondary">{step.summary}</Text>
              )}
            </div>
            <div className={style.stepBody}>
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

function isReaderHotkeyIgnoredTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "video" ||
    tagName === "audio" ||
    tagName === "button"
  ) {
    return true;
  }
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  if (target.closest(".monaco-editor")) return true;
  return false;
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
