import style from "../../../styles/panels/ErrorPanel.module.less";

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import classNames from "classnames";

import { useErrorStore, getErrorTypeLabel } from "../../../stores/errorStore";

function ErrorPanel() {
  const { t } = useTranslation();
  const errors = useErrorStore((state) => state.errors);

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
        <div className={classNames("title", style.title)}>
          {t("ui.panels.main.error.title", "错误列表")}
        </div>
      </div>
      <div className={style.list}>
        {errors.map((error, index) => (
          <div className={style.item} key={error.msg}>
            {`*[${index + 1}] [${getErrorTypeLabel(error.type)}] ${error.msg}`}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(ErrorPanel);
