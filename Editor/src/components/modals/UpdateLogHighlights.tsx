import {
  ExportOutlined,
  InfoCircleFilled,
  ReadOutlined,
} from "@ant-design/icons";
import React from "react";
import type {
  FeaturedNewsItem,
  PinnedNotice,
} from "../../data/updateLogs";
import style from "../../styles/modals/UpdateLogHighlights.module.less";

interface MarkdownContentProps {
  text: string;
}

export const MarkdownContent = ({ text }: MarkdownContentProps) => {
  const combinedRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)/g;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <a
          key={`link-${match.index}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className={style.markdownLink}
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      parts.push(<strong key={`bold-${match.index}`}>{match[5]}</strong>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

interface UpdateLogHighlightsProps {
  notice: PinnedNotice;
  news: FeaturedNewsItem[];
}

const noticeToneClass: Record<NonNullable<PinnedNotice["type"]>, string> = {
  info: style.noticeInfo,
  success: style.noticeSuccess,
  warning: style.noticeWarning,
};

const UpdateLogHighlights = ({
  notice,
  news,
}: UpdateLogHighlightsProps) => {
  const hasNotices = notice.content.length > 0;
  const hasNews = news.length > 0;

  if (!hasNotices && !hasNews) {
    return null;
  }

  return (
    <aside
      className={`${style.highlightsGrid} ${
        !hasNotices || !hasNews ? style.highlightsGridSingle : ""
      }`}
      aria-label="公告与精选内容"
    >
      {hasNotices && (
        <section
          className={`${style.noticePanel} ${
            noticeToneClass[notice.type ?? "info"]
          }`}
          aria-labelledby="update-log-notice-title"
        >
          <header className={style.highlightHeader}>
            <div className={style.highlightTitleRow}>
              <InfoCircleFilled className={style.noticeIcon} />
              <span id="update-log-notice-title" className={style.highlightTitle}>
                {notice.title || "置顶公告"}
              </span>
              <span className={style.highlightCount}>{notice.content.length}</span>
            </div>
          </header>

          <div className={style.noticeViewport}>
            <div className={style.noticeList}>
              {notice.content.map((item, index) => (
                <p key={index} className={style.noticeItem}>
                  <span className={style.noticeBullet}>•</span>
                  <span>
                    <MarkdownContent text={item} />
                  </span>
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasNews && (
        <div className={style.newsSlot}>
          <section
            className={style.newsPanel}
            aria-labelledby="update-log-news-title"
          >
            <header className={style.highlightHeader}>
              <div className={style.highlightTitleRow}>
                <ReadOutlined className={style.newsIcon} />
                <span
                  id="update-log-news-title"
                  className={style.highlightTitle}
                >
                  精选内容
                </span>
                <span className={style.highlightCount}>{news.length}</span>
              </div>
            </header>

            <div className={style.newsList}>
              {news.map((item) => (
                <a
                  key={`${item.category}-${item.title}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={style.newsItem}
                >
                  <span className={style.newsBody}>
                    <span className={style.newsMeta}>
                      <span className={style.newsCategory}>{item.category}</span>
                      {item.date && (
                        <time dateTime={item.date}>{item.date}</time>
                      )}
                    </span>
                    <span className={style.newsTitle}>{item.title}</span>
                    {item.summary && (
                      <span className={style.newsSummary}>{item.summary}</span>
                    )}
                  </span>
                  <ExportOutlined className={style.newsArrow} />
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
};

export default UpdateLogHighlights;
