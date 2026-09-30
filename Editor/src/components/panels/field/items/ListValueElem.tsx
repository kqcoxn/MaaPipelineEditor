import style from "../../../../styles/panels/FieldPanel.module.less";
import { InputNumber } from "antd";
import IconFont from "../../../iconfonts";
import type { ReactNode } from "react";
import { FieldTypeEnum } from "../../../../core/fields";
import { normalizeFieldList } from "./fieldValueUtils";
import { FieldTextArea } from "./FieldTextArea";

export function ListValueElem(
  key: string,
  valueList: any[],
  onChange: (key: string, valueList: any[]) => void,
  onAdd: (key: string, valueList: any[]) => void,
  onDelete: (key: string, valueList: any[], index: number) => void,
  placeholder = "list",
  step = 0,
  quickToolRender?: (key: string, index: number) => ReactNode,
) {
  valueList = normalizeFieldList(valueList, placeholder);
  const ListValue = valueList.map((value, index) => {
    const quickToolElem = quickToolRender?.(key, index);
    // 计算图标数量
    const iconCount =
      (quickToolElem ? (key === "expected" ? 2 : 1) : 0) +
      (valueList.length > 1 ? 1 : 0) +
      (index === valueList.length - 1 ? 1 : 0);

    // 输入框元素
    const inputElement =
      step > 0 ? (
        <InputNumber
          placeholder={placeholder}
          style={{ flex: 1 }}
          value={value}
          step={step}
          onChange={(e) => {
            valueList[index] = e;
            onChange(key, valueList);
          }}
        />
      ) : (
        <FieldTextArea
          value={value}
          placeholder={placeholder}
          parseJson={placeholder !== FieldTypeEnum.StringList}
          stringifyStrings={placeholder === FieldTypeEnum.IntOrStringList}
          parseObjectsOnly={placeholder === FieldTypeEnum.StringOrObjectList}
          onCommit={(newValue) => {
            const newList = [...valueList];
            newList[index] = newValue;
            onChange(key, newList);
          }}
        />
      );

    return (
      <div key={index}>
        {inputElement}
        <div
          className={style["icons-container"]}
          style={{ width: `${iconCount * 26}px` }}
        >
          {quickToolElem}
          {valueList.length > 1 ? (
            <div className={style.operation}>
              <IconFont
                className="icon-interactive"
                name={"icon-shanchu"}
                size={18}
                color={"#ff4a4a"}
                onClick={() => onDelete(key, valueList, index)}
              />
            </div>
          ) : null}
          {index === valueList.length - 1 ? (
            <div className={style.operation}>
              <IconFont
                className="icon-interactive"
                name={"icon-zengjiatianjiajiajian"}
                size={18}
                color={"#83be42"}
                onClick={() => onAdd(key, valueList)}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  });
  return <div className={style["list-value"]}>{ListValue}</div>;
}
