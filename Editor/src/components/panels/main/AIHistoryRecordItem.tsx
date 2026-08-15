import { memo, useState } from "react";
import { Button, Tag, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  DownOutlined,
  PictureOutlined,
  RobotOutlined,
  UpOutlined,
  UserOutlined,
} from "@ant-design/icons";
import classNames from "classnames";

import type { AIHistoryRecord } from "@/utils/ai/history";
import style from "../../../styles/panels/AIHistoryPanel.module.less";

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const AIHistoryRecordItem = memo(({ record }: { record: AIHistoryRecord }) => {
  const [actualMessageExpanded, setActualMessageExpanded] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);
  const hasDifferentActualMessage = record.actualMessage !== record.userPrompt;
  const response = record.success ? record.response : record.error || "未知错误";
  const isResponseTruncated = response.length > 320;
  const displayedResponse =
    isResponseTruncated && !responseExpanded
      ? `${response.slice(0, 320)}...`
      : response;

  return (
    <article className={style.recordItem}>
      <div className={style.recordMeta}>
        <time className={style.recordTime}>{formatDateTime(record.timestamp)}</time>
        <Tag
          color={record.success ? "success" : "error"}
          icon={record.success ? <CheckCircleOutlined /> : undefined}
        >
          {record.success ? "成功" : "失败"}
        </Tag>
        {record.hasImage && (
          <Tag color="blue" icon={<PictureOutlined />}>
            图片
          </Tag>
        )}
        {record.tokenUsage && (
          <Tooltip
            title={
              <div>
                <div>输入：{record.tokenUsage.promptTokens} tokens</div>
                <div>输出：{record.tokenUsage.completionTokens} tokens</div>
                <div>总计：{record.tokenUsage.totalTokens} tokens</div>
                {record.tokenUsage.isEstimated && <div>估算值</div>}
              </div>
            }
          >
            <Tag color="cyan">
              {record.tokenUsage.totalTokens.toLocaleString()} tokens
            </Tag>
          </Tooltip>
        )}
      </div>

      <div className={style.recordSection}>
        <div className={style.recordLabel}>
          <UserOutlined />
          <span>用户输入</span>
        </div>
        <div className={style.recordText}>
          {record.userPrompt || record.actualMessage || "（空消息）"}
        </div>
      </div>

      {hasDifferentActualMessage && (
        <div className={style.recordSection}>
          <Button
            type="text"
            size="small"
            className={style.detailButton}
            icon={actualMessageExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setActualMessageExpanded((expanded) => !expanded)}
          >
            实际消息
          </Button>
          {actualMessageExpanded && (
            <div className={classNames(style.recordText, style.actualMessage)}>
              {record.actualMessage}
              {record.textContent && record.textContent !== record.actualMessage && (
                <div className={style.textContent}>{record.textContent}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={style.recordSection}>
        <div className={style.recordLabel}>
          <RobotOutlined />
          <span>AI 回复</span>
        </div>
        <div
          className={classNames(style.recordText, {
            [style.errorText]: !record.success,
          })}
        >
          {displayedResponse || "（空回复）"}
        </div>
        {isResponseTruncated && (
          <Button
            type="link"
            size="small"
            className={style.expandButton}
            onClick={() => setResponseExpanded((expanded) => !expanded)}
          >
            {responseExpanded ? "收起回复" : "展开完整回复"}
          </Button>
        )}
      </div>
    </article>
  );
});

export default AIHistoryRecordItem;
