import style from "../../styles/FieldPanel.module.less";

import React, { useMemo, memo, useCallback, lazy, Suspense } from "react";
import {
  Popover,
  Input,
  InputNumber,
  Select,
  Switch,
  Spin,
  Tooltip,
} from "antd";
const { TextArea } = Input;
import classNames from "classnames";
import IconFont from "../iconfonts";

import {
  useFlowStore,
  type ParamType,
  type PipelineNodeType,
  type ExternalNodeType,
} from "../../stores/flowStore";
import { useFileStore } from "../../stores/fileStore";
import {
  recoFields,
  actionFields,
  otherFieldParams,
  FieldTypeEnum,
  type FieldType,
} from "../../core/fields";
import { JsonHelper } from "../../utils/jsonHelper";
import { NodeTypeEnum } from "../flow/nodes";
import { ClipboardHelper } from "../../utils/clipboard";

/**模块 */
// 提示词
function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

// 添加字段
const AddFieldElem = memo(
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
);

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
const ParamFieldListElem = memo(
  ({
    paramData,
    paramType,
    onChange,
    onDelete,
    onListChange,
    onListAdd,
    onListDelete,
  }: {
    paramData: ParamType;
    paramType: FieldType[];
    onChange: (key: string, value: any) => void;
    onDelete: (key: string) => void;
    onListChange: (key: string, valueList: any[]) => void;
    onListAdd: (key: string, valueList: any[]) => void;
    onListDelete: (key: string, valueList: any[], index: number) => void;
  }) => {
    const existingFields = Object.keys(paramData);
    const paramFields = paramType.flatMap((type) => {
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
          case FieldTypeEnum.XYWHList:
          case FieldTypeEnum.PositionList:
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
    return <>{paramFields}</>;
  }
);

// Pipeline节点
const PipelineElem = lazy(() =>
  Promise.resolve({
    default: memo(({ currentNode }: { currentNode: PipelineNodeType }) => {
      const setNodeData = useFlowStore((state) => state.setNodeData);

      // 字段
      const recoOptions = useMemo(
        () =>
          Object.keys(recoFields).map((key) => ({
            label: key,
            value: key,
          })),
        []
      );
      const actionOptions = useMemo(
        () =>
          Object.keys(actionFields).map((key) => ({
            label: key,
            value: key,
          })),
        []
      );

      // 标题
      const currentLabel = useMemo(
        () => currentNode.data.label || "",
        [currentNode.data.label]
      );
      const onLabelChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          setNodeData(currentNode.id, "", "label", e.target.value);
        },
        [currentNode]
      );

      // 识别算法
      const currentRecoName = useMemo(
        () => currentNode.data.recognition.type || "DirectHit",
        [currentNode.data.recognition.type]
      );
      const currentReco = useMemo(
        () => recoFields[currentRecoName] || { params: [], desc: "" },
        [currentRecoName]
      );
      const handleRecoChange = useCallback(
        (value: string) => {
          setNodeData(currentNode.id, "type", "recognition", value);
        },
        [currentNode]
      );

      // 动作
      const currentActionName = useMemo(
        () => currentNode.data.action.type || "DoNothing",
        [currentNode.data.action.type]
      );
      const currentAction = useMemo(
        () => actionFields[currentActionName] || { params: [], desc: "" },
        [currentActionName]
      );
      const handleActionChange = useCallback(
        (value: string) => {
          setNodeData(currentNode.id, "type", "action", value);
        },
        [currentNode]
      );

      // 自定义节点
      const currentExtra = useMemo(() => {
        const extra = currentNode.data.extras;
        return JsonHelper.objToString(extra) ?? extra;
      }, [currentNode]);
      const handleExtraChange = useCallback(
        (value: string) => {
          setNodeData(currentNode.id, "extras", "extras", value);
        },
        [currentNode]
      );

      return (
        <div className={style.list}>
          {/* 节点名 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"key"}
              content={"节点名，会被编译为 pipeline 的 key。"}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                key
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
            {currentNode ? (
              <AddFieldElem
                paramType={currentReco.params}
                paramData={currentNode.data.recognition.param}
                onClick={(param) =>
                  setNodeData(
                    currentNode.id,
                    "recognition",
                    param.key,
                    param.default
                  )
                }
              />
            ) : null}
          </div>
          {/* 算法字段 */}
          {currentNode ? (
            <ParamFieldListElem
              paramData={currentNode.data.recognition.param}
              paramType={
                recoFields[currentNode.data.recognition.type]?.params || []
              }
              onChange={(key, value) =>
                setNodeData(currentNode.id, "recognition", key, value)
              }
              onDelete={(key) =>
                setNodeData(currentNode.id, "recognition", key, "__mpe_delete")
              }
              onListChange={(key, valueList) =>
                setNodeData(currentNode.id, "recognition", key, valueList)
              }
              onListAdd={(key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "recognition", key, valueList);
              }}
              onListDelete={(key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "recognition", key, valueList);
              }}
            />
          ) : null}
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
            {currentNode ? (
              <AddFieldElem
                paramType={currentAction.params}
                paramData={currentNode.data.action.param}
                onClick={(param) =>
                  setNodeData(
                    currentNode.id,
                    "action",
                    param.key,
                    param.default
                  )
                }
              />
            ) : null}
          </div>
          {/* 动作字段 */}
          {currentNode ? (
            <ParamFieldListElem
              paramData={currentNode.data.action.param}
              paramType={
                actionFields[currentNode.data.action.type]?.params || []
              }
              onChange={(key, value) =>
                setNodeData(currentNode.id, "action", key, value)
              }
              onDelete={(key) =>
                setNodeData(currentNode.id, "action", key, "__mpe_delete")
              }
              onListChange={(key, valueList) =>
                setNodeData(currentNode.id, "action", key, valueList)
              }
              onListAdd={(key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "action", key, valueList);
              }}
              onListDelete={(key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "action", key, valueList);
              }}
            />
          ) : null}
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
              ————————————
            </div>
            {currentNode ? (
              <AddFieldElem
                paramType={otherFieldParams}
                paramData={currentNode.data.others}
                onClick={(param) =>
                  setNodeData(
                    currentNode.id,
                    "others",
                    param.key,
                    param.default
                  )
                }
              />
            ) : null}
          </div>
          {/* 其他字段 */}
          {currentNode ? (
            <ParamFieldListElem
              paramData={currentNode.data.others}
              paramType={otherFieldParams}
              onChange={(key, value) =>
                setNodeData(currentNode.id, "others", key, value)
              }
              onDelete={(key) =>
                setNodeData(currentNode.id, "others", key, "__mpe_delete")
              }
              onListChange={(key, valueList) =>
                setNodeData(currentNode.id, "others", key, valueList)
              }
              onListAdd={(key, valueList) => {
                valueList.push(valueList[valueList.length - 1]);
                setNodeData(currentNode.id, "others", key, valueList);
              }}
              onListDelete={(key, valueList, index) => {
                valueList.splice(index, 1);
                setNodeData(currentNode.id, "others", key, valueList);
              }}
            />
          ) : null}
          {/* 自定义字段 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"extras"}
              content={"自定义字段，JSON格式，会直接将一级字段渲染在节点上"}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                extras
              </div>
            </Popover>
            <div className={style.value}>
              <TextArea
                placeholder="自定义字段，完整 JSON 格式"
                autoSize={{ minRows: 1, maxRows: 6 }}
                value={currentExtra}
                onChange={(e) => handleExtraChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }),
  })
);

// External节点
const ExternalElem = memo(
  ({ currentNode }: { currentNode: ExternalNodeType }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);

    // 标题
    const currentLabel = useMemo(
      () => currentNode.data.label ?? "",
      [currentNode.data.label]
    );
    const onLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(currentNode.id, "", "label", e.target.value);
      },
      [currentNode]
    );

    return (
      <div className={style.list}>
        {/* 节点名 */}
        <div className={style.item}>
          <Popover
            placement="left"
            title={"key"}
            content={"节点名，转录时不会添加 prefix 前缀"}
          >
            <div
              className={classNames([style.key, style["head-key"]])}
              style={{ width: 48 }}
            >
              key
            </div>
          </Popover>
          <div className={style.value}>
            <Input
              placeholder="节点名 (转录时不会添加前缀)"
              value={currentLabel}
              onChange={onLabelChange}
            />
          </div>
        </div>
      </div>
    );
  }
);

// 工具栏
const ToolBarElem = memo(({ nodeName }: { nodeName: string }) => {
  const prefix = useFileStore((state) => state.currentFile.config.prefix);
  if (prefix) nodeName = prefix + "_" + nodeName;

  return (
    <div className={classNames(style.tools, "icon-interactive")}>
      <Tooltip placement="top" title={"复制节点名"}>
        <IconFont
          name="icon-xiaohongshubiaoti"
          size={24}
          onClick={() => {
            ClipboardHelper.write(nodeName);
          }}
        />
      </Tooltip>
    </div>
  );
});

// 面板
function FieldPanel() {
  const currentNode = useFlowStore((state) => state.targetNode);

  // 内容
  const renderContent = useMemo(() => {
    if (!currentNode) return null;
    switch (currentNode.type) {
      case NodeTypeEnum.Pipeline:
        return (
          <Suspense
            fallback={
              <Spin tip="Loading..." size="large">
                <div className={style.spin}></div>
              </Spin>
            }
          >
            <PipelineElem currentNode={currentNode} />
          </Suspense>
        );
      case NodeTypeEnum.External:
        return <ExternalElem currentNode={currentNode} />;
      default:
        return null;
    }
  }, [currentNode]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": currentNode !== null,
      }),
    [currentNode]
  );

  // 渲染
  return (
    <div className={panelClass}>
      <ToolBarElem nodeName={currentNode?.data.label ?? ""} />
      <div className="header">
        <div className="title">节点字段</div>
      </div>
      {renderContent}
    </div>
  );
}

export default memo(FieldPanel);
