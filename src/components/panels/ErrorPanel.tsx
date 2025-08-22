import style from "../../styles/ErrorPanel.module.less";

import { memo, useMemo } from "react";
import classNames from "classnames";

import { useErrorStore } from "../../stores/errorStore";

function ErrorPanel() {
  const errors = useErrorStore((state) => state.errors);

  // 样式
  const panelClass = useMemo(() => {
    return classNames({
      "panel-base": true,
      [style.panel]: true,
      "panel-show": errors.length > 0 ,
    });
  }, [errors.length]);

  // 渲染
  return (
    <div className={panelClass}>
      <div className="header">
        <div className={classNames("title", style.title)}>错误列表</div>
      </div>
      <div className={style.list}>
        {errors.map((error, index) => (
          <div className={style.item} key={error.msg}>
            {`*[${index + 1}] [${error.type}] ${error.msg}`}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(ErrorPanel);
