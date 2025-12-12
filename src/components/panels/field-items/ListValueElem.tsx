import style from "../../../styles/FieldPanel.module.less";
import { Input, InputNumber } from "antd";
import IconFont from "../../iconfonts";
import { JsonHelper } from "../../../utils/jsonHelper";

const { TextArea } = Input;

export function ListValueElem(
  key: string,
  valueList: any[],
  onChange: (key: string, valueList: any[]) => void,
  onAdd: (key: string, valueList: any[]) => void,
  onDelete: (key: string, valueList: any[], index: number) => void,
  placeholder = "list",
  step = 0
) {
  if (!Array.isArray(valueList)) {
    valueList = [valueList];
  }
  const ListValue = valueList.map((value, index) => {
    return (
      <div key={index}>
        {step > 0 ? (
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
          <TextArea
            placeholder={placeholder}
            value={JsonHelper.objToString(value) ?? value}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onChange={(e) => {
              valueList[index] = e.target.value;
              onChange(key, valueList);
            }}
          />
        )}
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
    );
  });
  return <div className={style["list-value"]}>{ListValue}</div>;
}
