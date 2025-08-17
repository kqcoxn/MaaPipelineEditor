import style from "../../styles/FieldPanel.module.less";

import React, { useMemo } from "react";
import classNames from "classnames";
import { Popover, Input, InputNumber, Select, Switch } from "antd";
const { TextArea } = Input;

import { useFlowStore, type ParamType } from "../../stores/flowStore";
import {
  recoFields,
  actionFields,
  otherFieldParams,
  FieldTypeEnum,
  type FieldType,
} from "../../core/fields";
import { JsonHelper } from "../../utils/jsonHelper";

import IconFont from "../iconfonts";

/**字段 */
const recoOptions = Object.keys(recoFields).map((key) => {
  return {
    label: key,
    value: key,
  };
});
const actionOptions = Object.keys(actionFields).map((key) => {
  return {
    label: key,
    value: key,
  };
});

/**模块 */
// 提示词
function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

// 添加字段
function AddFieldElem(
  paramType: FieldType[],
  paramData: ParamType,
  onClick: (param: FieldType) => void
) {
  if (paramType.length === 0) {
    return null;
  }
  const currentParams = Object.keys(paramData);
  const paramList = paramType.flatMap((param) => {
    if (currentParams.includes(param.key)) return [];
    return (
      <Popover
        key={param.key}
        placement="right"
        title={param.key}
        content={LeftTipContentElem(param.desc)}
      >
        <div className={style.param} onClick={() => onClick(param)}>
          {param.key}
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

// 已有字段
function ListValueElem(
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
function ParamFieldListElem(
  paramData: ParamType,
  paramType: FieldType[],
  onChange: (key: string, value: any) => void,
  onDelete: (key: string) => void,
  onListChange: (key: string, valueList: any[]) => void,
  onListAdd: (key: string, valueList: any[]) => void,
  onListDelete: (key: string, valueList: any[], index: number) => void
) {
  const existingFields = Object.keys(paramData);
  return paramType.flatMap((type) => {
    const key = type.key;
    const value = paramData[key];
    if (!existingFields.includes(key)) return [];
    // 输入方案
    let InputElem = null;
    let paramType = Array.isArray(type.type) ? type.type[0] : type.type;
    // 可选类型
    if ("options" in type) {
      const options =
        type.options?.map((item) => ({
          value: item,
          label: item,
        })) || [];
      InputElem = (
        <Select
          className={style.value}
          options={options}
          value={value}
          onChange={(e) => onChange(key, e)}
        />
      );
    } else {
      switch (paramType) {
        // 字符串列表
        case FieldTypeEnum.StringList:
        case FieldTypeEnum.IntListList:
        case FieldTypeEnum.StringPairList:
        case FieldTypeEnum.ObjectList:
          InputElem = ListValueElem(
            key,
            value,
            onListChange,
            onListAdd,
            onListDelete,
            paramType
          );
          break;
        // 数字列表
        case FieldTypeEnum.IntList:
        case FieldTypeEnum.DoubleList:
          InputElem = ListValueElem(
            key,
            value,
            onListChange,
            onListAdd,
            onListDelete,
            paramType,
            type.step
          );
          break;
        // 整型
        case FieldTypeEnum.Int:
          InputElem = (
            <InputNumber
              className={style.value}
              value={value}
              precision={0}
              step={type.step ?? 1}
              onChange={(e) => onChange(key, e)}
            />
          );
          break;
        // 浮点数
        case FieldTypeEnum.Double:
          InputElem = (
            <InputNumber
              className={style.value}
              value={value}
              step={type.step ?? 0.01}
              onChange={(e) => onChange(key, e)}
            />
          );
          break;
        // 布尔
        case FieldTypeEnum.Bool:
          InputElem = (
            <div style={{ flex: 1 }}>
              <Switch
                style={{ marginLeft: 14 }}
                checkedChildren="true"
                unCheckedChildren="false"
                defaultChecked={value}
                onChange={(e) => onChange(key, e)}
              />
            </div>
          );
          break;
        // 字符串
        default:
          InputElem = (
            <TextArea
              className={style.value}
              value={JsonHelper.objToString(value) ?? value}
              placeholder={String(paramType)}
              autoSize={{ minRows: 1, maxRows: 4 }}
              onChange={(e) => onChange(key, e.target.value)}
            />
          );
      }
    }
    // 组合
    return (
      <div key={key} className={style.item}>
        <Popover
          style={{ maxWidth: 10 }}
          placement="left"
          title={key}
          content={LeftTipContentElem(type.desc)}
        >
          <div className={style.key}>{key}</div>
        </Popover>
        {InputElem}
        <div className={style.operation}>
          <IconFont
            className="icon-interactive"
            style={{ width: 20 }}
            name="icon-lanzilajitongshanchu"
            size={16}
            onClick={() => onDelete(key)}
          />
        </div>
      </div>
    );
  });
}

// 面板
function FieldPanel() {
  // store
  const currentNode = useFlowStore((state) => state.targetNode);

  // 标题
  const setNodeData = useFlowStore((state) => state.setNodeData);
  const currentLabel = useMemo(
    () => currentNode?.data.label || "",
    [currentNode?.data.label]
  );
  const onLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentNode) return;
    setNodeData(currentNode.id, "", "label", e.target.value);
  };

  // 识别算法
  const currentRecoName = currentNode?.data.recognition.type || "DirectHit";
  const currentReco = useMemo(
    () => recoFields[currentRecoName],
    [currentNode?.data.recognition.type]
  );
  const handleRecoChange = (value: string) => {
    if (!currentNode) return;
    setNodeData(currentNode.id, "type", "recognition", value);
  };

  // 动作
  const currentActionName = currentNode?.data.action.type || "DoNothing";
  const currentAction = useMemo(
    () => actionFields[currentActionName],
    [currentNode?.data.action.type]
  );
  const handleActionChange = (value: string) => {
    if (!currentNode) return;
    setNodeData(currentNode.id, "type", "action", value);
  };

  // 自定义节点
  const handleExtraChange = (value: string) => {
    if (!currentNode) return;
    setNodeData(currentNode.id, "extras", "extras", value);
  };

  // 渲染
  return (
    <div
      className={classNames({
        [style.panel]: true,
        [style.show]: currentNode !== null,
        // [style.show]: true,
      })}
    >
      <div className={style.header}>
        <div className={style.title}>节点字段</div>
      </div>
      <div className={style.list}>
        {/* 节点名 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={"label"}
            content={"节点名，会被编译为 pipeline 的 key。"}
          >
            <div className={classNames([style.key, style["head-key"]])}>
              label
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder="节点名"
              value={currentLabel}
              onChange={onLabelChange}
            />
          </div>
        </div>
        {/* 识别算法 */}
        <div className={style.item}>
          <Popover
            style={{ maxWidth: 10 }}
            placement="left"
            title={"recognition"}
            content={LeftTipContentElem(
              `识别算法(${currentRecoName})：${currentReco.desc}`
            )}
          >
            <div className={classNames([style.key, style["head-key"]])}>
              recognition
            </div>
          </Popover>
          <div className={style.value}>
            <Select
              style={{ width: "100%" }}
              options={recoOptions}
              value={currentRecoName}
              onChange={handleRecoChange}
            />
          </div>
          {currentNode
            ? AddFieldElem(
                currentReco.params,
                currentNode?.data.recognition.param,
                (param) =>
                  setNodeData(
                    currentNode.id,
                    "recognition",
                    param.key,
                    param.default
                  )
              )
            : null}
        </div>
        {/* 算法字段 */}
        {currentNode
          ? ParamFieldListElem(
              currentNode.data.recognition.param,
              recoFields[currentNode.data.recognition.type]?.params || [],
              (key, value) =>
                setNodeData(currentNode.id, "recognition", key, value),
              (key) =>
                setNodeData(currentNode.id, "recognition", key, "__mpe_delete"),
              (key, valueList) =>
                setNodeData(currentNode.id, "recognition", key, valueList),
              (key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "recognition", key, valueList);
              },
              (key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "recognition", key, valueList);
              }
            )
          : null}
        {/* 动作类型 */}
        <div className={style.item}>
          <Popover
            style={{ maxWidth: 10 }}
            placement="left"
            title={"action"}
            content={LeftTipContentElem(
              `动作类型(${currentActionName})：${currentAction.desc}`
            )}
          >
            <div className={classNames([style.key, style["head-key"]])}>
              action
            </div>
          </Popover>
          <div className={style.value}>
            <Select
              style={{ width: "100%" }}
              options={actionOptions}
              value={currentActionName}
              onChange={handleActionChange}
            />
          </div>
          {currentNode
            ? AddFieldElem(
                currentAction.params,
                currentNode?.data.action.param,
                (param) =>
                  setNodeData(
                    currentNode.id,
                    "action",
                    param.key,
                    param.default
                  )
              )
            : null}
        </div>
        {/* 动作字段 */}
        {currentNode
          ? ParamFieldListElem(
              currentNode.data.action.param,
              actionFields[currentNode.data.action.type]?.params || [],
              (key, value) => setNodeData(currentNode.id, "action", key, value),
              (key) =>
                setNodeData(currentNode.id, "action", key, "__mpe_delete"),
              (key, valueList) =>
                setNodeData(currentNode.id, "action", key, valueList),
              (key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "action", key, valueList);
              },
              (key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "action", key, valueList);
              }
            )
          : null}
        {/* 其他 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={"others"}
            content={"除 recognition 与 action 之外的字段"}
          >
            <div className={classNames([style.key, style["head-key"]])}>
              others
            </div>
          </Popover>
          <div className={classNames([style.value, style.line])}>
            —————————————
          </div>
          {currentNode
            ? AddFieldElem(
                otherFieldParams,
                currentNode?.data.others,
                (param) =>
                  setNodeData(
                    currentNode.id,
                    "others",
                    param.key,
                    param.default
                  )
              )
            : null}
        </div>
        {/* 其他字段 */}
        {currentNode
          ? ParamFieldListElem(
              currentNode.data.others,
              otherFieldParams,
              (key, value) => setNodeData(currentNode.id, "others", key, value),
              (key) =>
                setNodeData(currentNode.id, "others", key, "__mpe_delete"),
              (key, valueList) =>
                setNodeData(currentNode.id, "others", key, valueList),
              (key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "others", key, valueList);
              },
              (key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "others", key, valueList);
              }
            )
          : null}
        {/* 自定义字段 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={"extras"}
            content={"自定义字段，JSON格式，会直接渲染在节点上"}
          >
            <div className={classNames([style.key, style["head-key"]])}>
              extras
            </div>
          </Popover>
          <div className={style.value}>
            <TextArea
              placeholder="自定义字段，完整 JSON 格式"
              autoSize={{ minRows: 1, maxRows: 6 }}
              onChange={(e) => handleExtraChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default FieldPanel;
