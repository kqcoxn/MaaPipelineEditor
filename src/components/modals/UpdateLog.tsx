import {
  Alert,
  Card,
  Empty,
  Modal,
  Segmented,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  longTermPreview,
  nextPreview,
  pinnedNotice,
  updateLogs,
  type ForecastItem,
  type ForecastSection,
  type UpdateCategory,
  type UpdateLogItem,
} from "../../data/updateLogs";
import style from "../../styles/modals/UpdateLog.module.less";

const { Title, Text } = Typography;

interface UpdateLogProps {
  open: boolean;
  onClose: () => void;
}

type CategoryFilter = "all" | keyof UpdateCategory;
type SelectedPanel =
  | { kind: "forecast" }
  | { kind: "version"; version: string };

const typeConfig: Record<
  UpdateLogItem["type"],
  { color: string; label: string }
> = {
  major: { color: "red", label: "重大更新" },
  feature: { color: "blue", label: "新功能" },
  fix: { color: "orange", label: "问题修复" },
  perf: { color: "green", label: "体验优化" },
};

const categoryConfig: Array<{
  key: keyof UpdateCategory;
  label: string;
}> = [
  { key: "features", label: "新功能" },
  { key: "perfs", label: "体验优化" },
  { key: "fixes", label: "问题修复" },
];

const categoryFilterOptions: Array<{
  label: string;
  value: CategoryFilter;
}> = [
  { label: "全部", value: "all" },
  ...categoryConfig.map(({ key, label }) => ({ label, value: key })),
];

const getUpdateItemCount = (updates: UpdateCategory) =>
  categoryConfig.reduce(
    (total, { key }) => total + (updates[key]?.length ?? 0),
    0
  );

const previewTagColors = ["gold", "cyan", "green", "purple"] as const;

const getStablePreviewTagColor = (item: ForecastItem, index: number) => {
  const seed = `${item.theme ?? ""}|${item.title}|${item.description ?? ""}|${index}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return previewTagColors[hash % previewTagColors.length];
};

const parseMarkdown = (text: string): (string | React.ReactElement)[] => {
  const combinedRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)/g;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      const linkText = match[2];
      const linkUrl = match[3];
      parts.push(
        <a
          key={`link-${match.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={style.markdownLink}
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      const boldText = match[5];
      parts.push(<strong key={`bold-${match.index}`}>{boldText}</strong>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

const VersionTypeTag = ({ type }: { type: UpdateLogItem["type"] }) => (
  <Tag color={typeConfig[type].color}>{typeConfig[type].label}</Tag>
);

interface VersionTimelineProps {
  logs: UpdateLogItem[];
  selectedPanel: SelectedPanel;
  onSelectForecast: () => void;
  onSelectVersion: (version: string) => void;
}

const VersionTimeline = ({
  logs,
  selectedPanel,
  onSelectForecast,
  onSelectVersion,
}: VersionTimelineProps) => (
  <Card
    size="small"
    title={
      <div className={style.timelineTitle}>
        <span>版本</span>
        <Text type="secondary" className={style.statText}>
          共{logs.length}个版本
        </Text>
      </div>
    }
    className={style.timelineCard}
    styles={{ body: { padding: 0 } }}
  >
    <div className={style.timelineScroll} aria-label="版本时间线">
      <button
        type="button"
        className={`${style.forecastButton} ${
          selectedPanel.kind === "forecast" ? style.versionButtonSelected : ""
        }`}
        aria-current={selectedPanel.kind === "forecast" ? "step" : undefined}
        onClick={onSelectForecast}
      >
        <span className={style.versionButtonTop}>
          <span className={style.versionNumber}>下期预告 / 长期预告</span>
          <Tag color="purple">预告</Tag>
        </span>
        <span className={style.versionDate}>近期计划与方向规划</span>
      </button>
      <Timeline
        className={style.timeline}
        items={logs.map((log) => {
          const isSelected =
            selectedPanel.kind === "version" &&
            log.version === selectedPanel.version;

          return {
            color: typeConfig[log.type].color,
            dot: isSelected ? (
              <ClockCircleOutlined className={style.timelineDot} />
            ) : undefined,
            children: (
              <button
                type="button"
                className={`${style.versionButton} ${
                  isSelected ? style.versionButtonSelected : ""
                }`}
                aria-current={isSelected ? "step" : undefined}
                onClick={() => onSelectVersion(log.version)}
              >
                <span className={style.versionButtonTop}>
                  <span className={style.versionNumber}>v{log.version}</span>
                  <VersionTypeTag type={log.type} />
                </span>
                <span className={style.versionDate}>{log.date}</span>
              </button>
            ),
          };
        })}
      />
    </div>
  </Card>
);

interface UpdateLogDetailsProps {
  log: UpdateLogItem;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
}

const UpdateLogDetails = ({
  log,
  categoryFilter,
  onCategoryFilterChange,
}: UpdateLogDetailsProps) => {
  const updateCount = getUpdateItemCount(log.updates);
  const visibleCategories = categoryConfig.filter(({ key }) => {
    if (categoryFilter !== "all" && categoryFilter !== key) {
      return false;
    }

    const items = log.updates[key];
    return Boolean(items && items.length > 0);
  });

  return (
    <Card className={style.detailsCard}>
      <div className={style.detailsHeader}>
        <div>
          <div className={style.detailsVersionRow}>
            <Title level={3} className={style.detailsTitle}>
              v{log.version}
            </Title>
            <VersionTypeTag type={log.type} />
          </div>
          <Text type="secondary">{log.date}</Text>
        </div>
        <Text type="secondary" className={style.statText}>
          共{updateCount}项更新
        </Text>
      </div>

      <Segmented
        className={style.categoryFilter}
        aria-label="筛选更新分类"
        options={categoryFilterOptions}
        value={categoryFilter}
        onChange={(value) => onCategoryFilterChange(value as CategoryFilter)}
        block
      />

      <div className={style.categoryList}>
        {visibleCategories.length > 0 ? (
          visibleCategories.map(({ key, label }) => {
            const items = log.updates[key];
            if (!items || items.length === 0) {
              return null;
            }

            return (
              <section key={key} className={style.categorySection}>
                <Title level={5} className={style.categoryTitle}>
                  {label}
                </Title>
                <div className={style.updateItemList}>
                  {items.map((item, index) => (
                    <p key={index} className={style.updateItem}>
                      <span className={style.updateBullet}>•</span>
                      <span>{parseMarkdown(item)}</span>
                    </p>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                该版本没有此分类更新
                <br />
                可切换到“全部”查看完整更新内容。
              </span>
            }
            className={style.emptyState}
          />
        )}
      </div>
    </Card>
  );
};

interface ForecastPanelProps {
  nextSection: ForecastSection;
  longTermSection: ForecastSection;
}

const ForecastPanel = ({
  nextSection,
  longTermSection,
}: ForecastPanelProps) => (
  <Card className={style.detailsCard}>
    <div className={style.forecastGrid}>
      <Card title={nextSection.title} className={style.forecastCard}>
        <Text type="secondary" className={style.forecastNotice}>
          {nextSection.notice}
        </Text>
        <div className={style.previewList}>
          {nextSection.items.map((item, index) => (
            <div key={`${item.theme ?? "next"}-${item.title}`} className={style.previewItem}>
              <div className={style.previewItemHeader}>
                {item.theme && (
                  <Tag color={getStablePreviewTagColor(item, index)}>
                    {item.theme}
                  </Tag>
                )}
                <Text strong>{item.title}</Text>
              </div>
              {item.description && (
                <Text type="secondary" className={style.previewDescription}>
                  {item.description}
                </Text>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title={longTermSection.title} className={style.forecastCard}>
        <Text type="secondary" className={style.forecastNotice}>
          {longTermSection.notice}
        </Text>
        <div className={style.previewList}>
          {longTermSection.items.map((item, index) => (
            <div key={`${item.theme ?? "long"}-${item.title}`} className={style.previewItem}>
              <div className={style.previewItemHeader}>
                {item.theme && (
                  <Tag color={getStablePreviewTagColor(item, index)}>
                    {item.theme}
                  </Tag>
                )}
                <Text strong>{item.title}</Text>
              </div>
              <Text type="secondary" className={style.previewDescription}>
                {item.description}
              </Text>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </Card>
);

const UpdateLog = ({ open, onClose }: UpdateLogProps) => {
  const latestVersion = updateLogs[0]?.version ?? "";
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel>({
    kind: "version",
    version: latestVersion,
  });
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    if (open) {
      setSelectedPanel({ kind: "version", version: latestVersion });
      setCategoryFilter("all");
    }
  }, [latestVersion, open]);

  const selectedLog = useMemo(
    () =>
      selectedPanel.kind === "version"
        ? updateLogs.find((log) => log.version === selectedPanel.version) ??
          updateLogs[0]
        : undefined,
    [selectedPanel]
  );

  return (
    <Modal
      title={
        <div className={style.modalTitle}>
          <ClockCircleOutlined className={style.modalTitleIcon} />
          <span>更新日志</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1120}
      className={style.updateLogModal}
      styles={{
        body: {
          height: "min(74vh, 680px)",
          overflow: "hidden",
          padding: 24,
        },
      }}
    >
      {pinnedNotice.content && pinnedNotice.content.length > 0 && (
        <Alert
          message={pinnedNotice.title || "置顶公告"}
          description={
            <div className={style.noticeList}>
              {pinnedNotice.content.map((item, index) => (
                <p key={index} className={style.noticeItem}>
                  <span className={style.noticeBullet}>•</span>
                  <span>{parseMarkdown(item)}</span>
                </p>
              ))}
            </div>
          }
          type={pinnedNotice.type || "info"}
          showIcon
          className={style.pinnedNotice}
        />
      )}

      {updateLogs.length > 0 && (
        <div className={style.mainGrid}>
          <VersionTimeline
            logs={updateLogs}
            selectedPanel={selectedPanel}
            onSelectForecast={() => setSelectedPanel({ kind: "forecast" })}
            onSelectVersion={(version) =>
              setSelectedPanel({ kind: "version", version })
            }
          />
          {selectedPanel.kind === "forecast" ? (
            <ForecastPanel
              nextSection={nextPreview}
              longTermSection={longTermPreview}
            />
          ) : selectedLog ? (
            <UpdateLogDetails
              log={selectedLog}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
            />
          ) : (
            <Card className={style.detailsCard}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无更新日志"
                className={style.emptyState}
              />
            </Card>
          )}
        </div>
      )}
    </Modal>
  );
};

export default UpdateLog;
