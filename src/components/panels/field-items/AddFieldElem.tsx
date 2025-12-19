import style from "../../../styles/FieldPanel.module.less";
import { memo } from "react";
import { Popover } from "antd";
import IconFont from "../../iconfonts";
import type { ParamType } from "../../../stores/flow";
import type { FieldType } from "../../../core/fields";

function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

export const AddFieldElem = memo(
  ({
    paramType,
    paramData,
    onClick,
  }: {
    paramType: FieldType[];
    paramData: ParamType;
    onClick: (param: FieldType) => void;
  }) => {
    if (paramType.length === 0) {
      return null;
    }
    const currentParams = Object.keys(paramData);
    const paramList = paramType.flatMap((param) => {
      if (currentParams.includes(param.key)) return [];
      // 使用 displayName 或 key 作为显示名称
      const displayText = param.displayName || param.key;
      return (
        <Popover
          key={param.key}
          placement="right"
          title={param.key}
          content={LeftTipContentElem(param.desc)}
        >
          <div className={style.param} onClick={() => onClick(param)}>
            {displayText}
          </div>
        </Popover>
      );
    });

    return paramList.length ? (
      <Popover
        placement="bottom"
        content={<div className={style["param-list"]}>{paramList}</div>}
      >
        <div className={style.operation}>
          <IconFont
            className="icon-interactive"
            style={{ width: 24 }}
            name="icon-xinghaoxiangqing-canshuduibi-jishucanshu-20"
            color={"#1296db"}
            size={26}
          />
        </div>
      </Popover>
    ) : null;
  }
);
