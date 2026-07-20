import {
  Alert,
  Card,
  Empty,
  Modal,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  getLocalizedLongTermPreview,
  getLocalizedNextPreview,
  getLocalizedPinnedNotice,
  getLocalizedUpdateLogs,
} from "../../data/localize";
import {
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

type SelectedPanel =
  | { kind: "forecast" }
  | { kind: "version"; version: string };

type TypeConfig = Record<
  UpdateLogItem["type"],
  { color: string; label: string }
>;

type CategoryConfig = Array<{
  key: keyof UpdateCategory;
  label: string;
}>;

function buildTypeConfig(t: TFunction): TypeConfig {
  return {
    major: {
      color: "red",
      label: t("updateLog.types.major", "重大更新"),
    },
    feature: {
      color: "blue",
      label: t("updateLog.types.feature", "新功能"),
    },
    fix: {
      color: "orange",
      label: t("updateLog.types.fix", "问题修复"),
    },
    perf: {
      color: "green",
      label: t("updateLog.types.perf", "体验优化"),
    },
  };
}

function buildCategoryConfig(t: TFunction): CategoryConfig {
  return [
    { key: "features", label: t("updateLog.categories.features", "新功能") },
    { key: "perfs", label: t("updateLog.categories.perfs", "体验优化") },
    { key: "fixes", label: t("updateLog.categories.fixes", "问题修复") },
  ];
}

const getUpdateItemCount = (updates: UpdateCategory) =>
  (["features", "perfs", "fixes"] as const).reduce(
    (total, key) => total + (updates[key]?.length ?? 0),
    0,
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

const VersionTypeTag = ({
  type,
  typeConfig,
}: {
  type: UpdateLogItem["type"];
  typeConfig: TypeConfig;
}) => <Tag color={typeConfig[type].color}>{typeConfig[type].label}</Tag>;

interface VersionTimelineProps {
  logs: UpdateLogItem[];
  selectedPanel: SelectedPanel;
  typeConfig: TypeConfig;
  onSelectForecast: () => void;
  onSelectVersion: (version: string) => void;
}

const VersionTimeline = ({
  logs,
  selectedPanel,
  typeConfig,
  onSelectForecast,
  onSelectVersion,
}: VersionTimelineProps) => {
  const { t } = useTranslation();

  return (
    <Card
      size="small"
      title={
        <div className={style.timelineTitle}>
          <span>{t("updateLog.versions", "版本")}</span>
          <Text type="secondary" className={style.statText}>
            {t("updateLog.versionCount", "共{{count}}个版本", {
              count: logs.length,
            })}
          </Text>
        </div>
      }
      className={style.timelineCard}
      styles={{ body: { padding: 0 } }}
    >
      <div
        className={style.timelineScroll}
        aria-label={t("updateLog.timelineAriaLabel", "版本时间线")}
      >
        <button
          type="button"
          className={`${style.forecastButton} ${
            selectedPanel.kind === "forecast" ? style.versionButtonSelected : ""
          }`}
          aria-current={selectedPanel.kind === "forecast" ? "step" : undefined}
          onClick={onSelectForecast}
        >
          <span className={style.versionButtonTop}>
            <span className={style.versionNumber}>
              {t("updateLog.forecastButton", "下期预告 / 长期预告")}
            </span>
            <Tag color="purple">
              {t("updateLog.forecastTag", "预告")}
            </Tag>
          </span>
          <span className={style.versionDate}>
            {t("updateLog.forecastSubtitle", "近期计划与方向规划")}
          </span>
        </button>
        <Timeline
          className={style.timeline}
          items={logs.map((log) => {
            const isSelected =
              selectedPanel.kind === "version" &&
              log.version === selectedPanel.version;

            return {
              color: typeConfig[log.type].color,
              icon: isSelected ? (
                <ClockCircleOutlined className={style.timelineDot} />
              ) : undefined,
              content: (
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
                    <VersionTypeTag type={log.type} typeConfig={typeConfig} />
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
};

interface UpdateLogDetailsProps {
  log: UpdateLogItem;
  typeConfig: TypeConfig;
  categoryConfig: CategoryConfig;
}

const UpdateLogDetails = ({
  log,
  typeConfig,
  categoryConfig,
}: UpdateLogDetailsProps) => {
  const { t } = useTranslation();
  const updateCount = getUpdateItemCount(log.updates);
  const visibleCategories = categoryConfig.filter(({ key }) => {
    const items = log.updates[key];
    return Boolean(items && items.length > 0);
  });

  return (
    <Card className={style.detailsCard}>
      <div className={style.detailsHeader}>
        <div className={style.detailsVersionRow}>
          <Title level={3} className={style.detailsTitle}>
            v{log.version}
          </Title>
          <VersionTypeTag type={log.type} typeConfig={typeConfig} />
        </div>
        <Text type="secondary" className={style.statText}>
          {t("updateLog.updateCount", "{{date}} / 共 {{count}} 项更新", {
            date: log.date,
            count: updateCount,
          })}
        </Text>
      </div>

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
            description={t("updateLog.emptyVersion", "该版本暂无更新内容")}
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
            <div
              key={`${item.theme ?? "next"}-${item.title}`}
              className={style.previewItem}
            >
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
            <div
              key={`${item.theme ?? "long"}-${item.title}`}
              className={style.previewItem}
            >
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
  const { t } = useTranslation();
  const typeConfig = useMemo(() => buildTypeConfig(t), [t]);
  const categoryConfig = useMemo(() => buildCategoryConfig(t), [t]);
  const updateLogs = useMemo(() => getLocalizedUpdateLogs(t), [t]);
  const pinnedNotice = useMemo(() => getLocalizedPinnedNotice(t), [t]);
  const longTermPreview = useMemo(() => getLocalizedLongTermPreview(t), [t]);
  const nextPreview = useMemo(() => getLocalizedNextPreview(t), [t]);
  const latestVersion = updateLogs[0]?.version ?? "";
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel>({
    kind: "version",
    version: latestVersion,
  });

  useEffect(() => {
    if (open) {
      setSelectedPanel({ kind: "version", version: latestVersion });
    }
  }, [latestVersion, open]);

  const selectedLog = useMemo(
    () =>
      selectedPanel.kind === "version"
        ? updateLogs.find((log) => log.version === selectedPanel.version) ??
          updateLogs[0]
        : undefined,
    [selectedPanel, updateLogs],
  );

  return (
    <Modal
      title={
        <div className={style.modalTitle}>
          <ClockCircleOutlined className={style.modalTitleIcon} />
          <span>{t("updateLog.title", "更新日志")}</span>
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
          title={
            pinnedNotice.title ||
            t("data.updateLogs.pinned.title", "置顶公告")
          }
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
            typeConfig={typeConfig}
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
              typeConfig={typeConfig}
              categoryConfig={categoryConfig}
            />
          ) : (
            <Card className={style.detailsCard}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t("updateLog.emptyLogs", "暂无更新日志")}
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
