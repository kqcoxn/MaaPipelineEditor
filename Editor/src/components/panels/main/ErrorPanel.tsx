import style from "../../../styles/panels/ErrorPanel.module.less";

import { memo, useMemo } from "react";
import classNames from "classnames";

import { useErrorStore } from "@/stores/app/errorStore";
import { VirtualList } from "@/components/common/VirtualList";

const ERROR_ROW_HEIGHT = 26;
const MAX_ERROR_LIST_HEIGHT = 234;

function ErrorPanel() {
  const errors = useErrorStore((state) => state.errors);
  const errorRows = useMemo(() => {
    const occurrences = new Map<string, number>();
    return errors.map((error, index) => {
      const identity = `${error.type}:${error.mark ?? error.msg}`;
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      return {
        error,
        index,
        key: `${identity}:${occurrence}`,
      };
    });
  }, [errors]);

  // 样式
  const panelClass = useMemo(() => {
    return classNames({
      "panel-base": true,
      [style.panel]: true,
      "panel-show": errors.length > 0,
    });
  }, [errors.length]);

  // 渲染
  return (
    <div className={panelClass}>
      <div className="header">
        <div className={classNames("title", style.title)}>错误列表</div>
      </div>
      {errorRows.length > 0 && (
        <VirtualList
          ariaLabel={`错误列表，共 ${errorRows.length} 条`}
          className={style.list}
          estimatedItemHeight={ERROR_ROW_HEIGHT}
          height={Math.min(
            MAX_ERROR_LIST_HEIGHT,
            errorRows.length * ERROR_ROW_HEIGHT,
          )}
          itemKey={(row) => row.key}
          items={errorRows}
          renderItem={({ error, index }) => (
            <div className={style.item}>
              {`*[${index + 1}] [${error.type}] ${error.msg}`}
            </div>
          )}
        />
      )}
    </div>
  );
}

export default memo(ErrorPanel);
