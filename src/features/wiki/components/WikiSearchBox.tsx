import { Empty, Input, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { WikiSearchResult, WikiTarget } from "../../../wiki/types";
import style from "./WikiSearchBox.module.less";

const { Text } = Typography;

export function WikiSearchBox({
  value,
  results,
  onChange,
  onSelectTarget,
}: {
  value: string;
  results: WikiSearchResult[];
  onChange: (value: string) => void;
  onSelectTarget: (target: WikiTarget) => void;
}) {
  const keyword = value.trim();
  const searching = keyword.length > 0;

  return (
    <div className={style.searchShell}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索 Wiki 条目、模块或步骤"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {searching && (
        <section className={style.resultPanel}>
          {results.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="没有找到匹配内容"
            />
          ) : (
            <div className={style.resultList}>
              {results.map((result) => (
                <button
                  key={`${result.target.entryId}/${result.target.moduleId}/${result.target.stepId}`}
                  type="button"
                  className={style.resultItem}
                  onClick={() => onSelectTarget(result.target)}
                >
                  <span className={style.resultPath}>
                    {formatResultPath(result)}
                  </span>
                  <Text strong>{result.stepTitle ?? result.moduleTitle}</Text>
                  <span className={style.resultSummary}>{result.summary}</span>
                  <span className={style.resultMatchedText}>
                    {result.matchedText}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function formatResultPath(result: WikiSearchResult) {
  return [result.entryTitle, result.moduleTitle, result.stepTitle]
    .filter(Boolean)
    .join(" / ");
}
