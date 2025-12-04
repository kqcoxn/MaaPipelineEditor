import { memo } from "react";
import style from "../../../styles/nodes.module.less";
import { JsonHelper } from "../../../../utils/jsonHelper";

/**键值对元素组件 */
export const KVElem = memo(
  ({ paramKey, value }: { paramKey: string; value: any }) => {
    return (
      <li key={paramKey}>
        <div className={style.key}>{paramKey}</div>
        <div className={style.value}>
          <div className={style.container}>
            {JsonHelper.objToString(value) ?? String(value) ?? ""}
          </div>
        </div>
      </li>
    );
  }
);
