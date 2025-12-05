import style from "../../styles/AIHistoryPanel.module.less";

import { memo, useMemo, useState, useEffect } from "react";
import { Empty, Tag, Tooltip } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import { useConfigStore } from "../../stores/configStore";
import { aiHistoryManager, type AIHistoryRecord } from "../../utils/openai";

/** 格式化时间 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

/** 单条历史记录组件 */
const HistoryItem = memo(({ record }: { record: AIHistoryRecord }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={style.item}>
      <div className={style.header}>
        <span className={style.time}>{formatTime(record.timestamp)}</span>
        <Tag color={record.success ? "success" : "error"} className={style.tag}>
          {record.success ? "成功" : "失败"}
        </Tag>
        {record.actualMessage !== record.userPrompt && (
          <Tooltip title="实际消息包含预设提示词">
            <Tag color="processing" className={style.tag}>
              含提示词
            </Tag>
          </Tooltip>
        )}
      </div>

      <div className={style.content}>
        <div className={style.section}>
          <div className={style.label}>用户输入:</div>
          <div className={style.text}>{record.userPrompt}</div>
        </div>

        {record.actualMessage !== record.userPrompt && (
          <div className={style.section}>
            <div
              className={style.expandLabel}
              onClick={() => setExpanded(!expanded)}
            >
              <span>实际消息</span>
              <IconFont
                name={expanded ? "icon-xiahua" : "icon-qianjin"}
                size={12}
                style={{ marginLeft: 4 }}
              />
            </div>
            {expanded && (
              <div className={classNames(style.text, style.actualMessage)}>
                {record.actualMessage}
              </div>
            )}
          </div>
        )}

        <div className={style.section}>
          <div className={style.label}>AI 回复:</div>
          <div className={style.text}>
            {record.success ? (
              record.response || "(空回复)"
            ) : (
              <span className={style.error}>{record.error || "未知错误"}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/** AI 对话历史面板 */
function AIHistoryPanel() {
  // store
  const showAIHistoryPanel = useConfigStore(
    (state) => state.status.showAIHistoryPanel
  );
  const setStatus = useConfigStore((state) => state.setStatus);

  // 历史记录
  const [records, setRecords] = useState<AIHistoryRecord[]>([]);

  // 订阅历史变化
  useEffect(() => {
    // 初始加载
    setRecords(aiHistoryManager.getRecords());

    // 订阅变化
    const unsubscribe = aiHistoryManager.subscribe(() => {
      setRecords(aiHistoryManager.getRecords());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 清空历史
  const handleClear = () => {
    aiHistoryManager.clearRecords();
  };

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": showAIHistoryPanel,
      }),
    [showAIHistoryPanel]
  );

  // 渲染
  return (
    <div className={panelClass}>
      <div className={classNames("header", style.header)}>
        <div className="title">AI 对话历史</div>
        <div className={style.right}>
          {records.length > 0 && (
            <Tooltip title="清空历史">
              <IconFont
                className="icon-interactive"
                name="icon-lanzilajitongshanchu"
                size={18}
                onClick={handleClear}
              />
            </Tooltip>
          )}
          <IconFont
            className="icon-interactive"
            name="icon-dituweizhixinxi_chahao"
            size={20}
            onClick={() => setStatus("showAIHistoryPanel", false)}
          />
        </div>
      </div>
      <div className={style.list}>
        {records.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无对话记录"
            style={{ marginTop: 40 }}
          />
        ) : (
          records.map((record) => (
            <HistoryItem key={record.id} record={record} />
          ))
        )}
      </div>
    </div>
  );
}

export default memo(AIHistoryPanel);
