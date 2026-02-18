import style from "../../../../styles/FieldPanel.module.less";
import { Input, InputNumber } from "antd";
import IconFont from "../../../iconfonts";
import { JsonHelper } from "../../../../utils/jsonHelper";
import { useState, useEffect, memo, type ReactNode } from "react";
import { FieldTypeEnum } from "../../../../core/fields";

const { TextArea } = Input;

/**
 * 带本地状态的 TextArea，只在失焦时触发更新
 */
const LocalTextArea = memo(
  ({
    value,
    placeholder,
    onCommit,
  }: {
    value: any;
    placeholder: string;
    onCommit: (newValue: any) => void;
  }) => {
    // 将值转为字符串显示：字符串直接显示，对象/数组转 JSON
    const displayValue =
      typeof value === "string"
        ? value
        : JsonHelper.objToString(value) ?? String(value ?? "");
    const [localValue, setLocalValue] = useState(displayValue);

    // 同步外部值变化
    useEffect(() => {
      setLocalValue(displayValue);
    }, [displayValue]);

    return (
      <TextArea
        placeholder={placeholder}
        value={localValue}
        autoSize={{ minRows: 1, maxRows: 4 }}
        onChange={(e) => {
          // 编辑时只更新本地状态，不触发父组件更新
          setLocalValue(e.target.value);
        }}
        onBlur={() => {
          // 失焦时尝试解析并提交
          try {
            // 尝试解析为 JSON 值
            const parsed = JSON.parse(localValue);
            onCommit(parsed);
          } catch {
            // 保留原始字符串
            onCommit(localValue);
          }
        }}
      />
    );
  }
);

export function ListValueElem(
  key: string,
  valueList: any[],
  onChange: (key: string, valueList: any[]) => void,
  onAdd: (key: string, valueList: any[]) => void,
  onDelete: (key: string, valueList: any[], index: number) => void,
  placeholder = "list",
  step = 0,
  quickToolRender?: (key: string, index: number) => ReactNode
) {
  if (!Array.isArray(valueList)) {
    valueList = [valueList];
  }

  // 内层数组被视为一个整体
  if (placeholder === FieldTypeEnum.IntListList) {
    if (valueList.length > 0 && typeof valueList[0] === "number") {
      valueList = [valueList];
    }
  }
  const ListValue = valueList.map((value, index) => {
    const quickToolElem = quickToolRender?.(key, index);
    // 计算图标数量
    const iconCount =
      (quickToolElem ? 1 : 0) +
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
        <LocalTextArea
          value={value}
          placeholder={placeholder}
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
