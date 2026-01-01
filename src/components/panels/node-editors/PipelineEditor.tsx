import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback, lazy, Suspense } from "react";
import { Popover, Input, Select, Spin, Modal } from "antd";
import classNames from "classnames";
import { useFlowStore, type PipelineNodeType } from "../../../stores/flow";
import {
  recoFields,
  actionFields,
  otherFieldParamsWithoutFocus,
  otherFieldSchema,
} from "../../../core/fields";
import { JsonHelper } from "../../../utils/jsonHelper";
import { AddFieldElem, ParamFieldListElem } from "../field/items";

const { TextArea } = Input;

function LeftTipContentElem(content: string) {
  return <div style={{ maxWidth: 260 }}>{content}</div>;
}

export const PipelineEditor = lazy(() =>
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
        () => recoFields[currentRecoName],
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
        () => actionFields[currentActionName],
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

      // focus 字段状态判断
      const currentFocus = useMemo(
        () => currentNode.data.others.focus,
        [currentNode.data.others.focus]
      );
      const isFocusObjectMode = useMemo(() => {
        return (
          typeof currentFocus === "object" &&
          currentFocus !== null &&
          !Array.isArray(currentFocus) &&
          Object.keys(currentFocus).length > 0
        );
      }, [currentFocus]);

      // focus 字段更新处理
      const handleFocusStringChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          setNodeData(currentNode.id, "others", "focus", e.target.value);
        },
        [currentNode]
      );

      const handleFocusFieldAdd = useCallback(
        (param: any) => {
          const currentFocusValue = currentNode.data.others.focus;
          // 字符串有内容时提示
          if (
            typeof currentFocusValue === "string" &&
            currentFocusValue.trim() !== ""
          ) {
            Modal.confirm({
              title: "切换到结构化模式",
              content: "切换到结构化模式会丢失当前的字符串值,是否继续?",
              onOk: () => {
                const newFocus = { [param.key]: param.default };
                setNodeData(currentNode.id, "others", "focus", newFocus);
              },
            });
          } else {
            // 直接添加
            const newFocus =
              typeof currentFocusValue === "object" &&
              currentFocusValue !== null
                ? { ...currentFocusValue, [param.key]: param.default }
                : { [param.key]: param.default };
            setNodeData(currentNode.id, "others", "focus", newFocus);
          }
        },
        [currentNode]
      );

      const handleFocusFieldChange = useCallback(
        (key: string, value: any) => {
          const currentFocusValue = currentNode.data.others.focus;
          if (
            typeof currentFocusValue === "object" &&
            currentFocusValue !== null
          ) {
            const newFocus = { ...currentFocusValue, [key]: value };
            setNodeData(currentNode.id, "others", "focus", newFocus);
          }
        },
        [currentNode]
      );

      const handleFocusFieldDelete = useCallback(
        (key: string) => {
          const currentFocusValue = currentNode.data.others.focus;
          if (
            typeof currentFocusValue === "object" &&
            currentFocusValue !== null
          ) {
            const newFocus = { ...currentFocusValue };
            delete newFocus[key];
            // 回退到字符串模式
            if (Object.keys(newFocus).length === 0) {
              setNodeData(currentNode.id, "others", "focus", "");
            } else {
              setNodeData(currentNode.id, "others", "focus", newFocus);
            }
          }
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
              content={"除 recognition、action、focus 之外的字段"}
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
                paramType={otherFieldParamsWithoutFocus}
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
              paramType={otherFieldParamsWithoutFocus}
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
          {/* focus 字段 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"focus"}
              content={
                "关注节点，会额外产生部分回调消息。可选，默认 null，不产生回调消息。详见 节点通知。"
              }
            >
              <div className={classNames([style.key, style["head-key"]])}>
                focus
              </div>
            </Popover>
            {isFocusObjectMode ? (
              <>
                <div className={classNames([style.value, style.line])}>
                  ————————————
                </div>
                {currentNode && otherFieldSchema.focus.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.focus.params}
                    paramData={
                      typeof currentFocus === "object" && currentFocus !== null
                        ? currentFocus
                        : {}
                    }
                    onClick={handleFocusFieldAdd}
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className={style.value}>
                  <Input
                    placeholder="字符串值，或点击右侧按钮添加消息类型"
                    value={typeof currentFocus === "string" ? currentFocus : ""}
                    onChange={handleFocusStringChange}
                  />
                </div>
                {currentNode && otherFieldSchema.focus.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.focus.params}
                    paramData={{}}
                    onClick={handleFocusFieldAdd}
                  />
                ) : null}
              </>
            )}
          </div>
          {/* focus 子字段 */}
          {isFocusObjectMode && currentNode ? (
            <ParamFieldListElem
              paramData={
                typeof currentFocus === "object" && currentFocus !== null
                  ? currentFocus
                  : {}
              }
              paramType={otherFieldSchema.focus.params || []}
              onChange={handleFocusFieldChange}
              onDelete={handleFocusFieldDelete}
              onListChange={() => {}}
              onListAdd={() => {}}
              onListDelete={() => {}}
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

// 异步初渲染
export const PipelineEditorWithSuspense = ({
  currentNode,
}: {
  currentNode: PipelineNodeType;
}) => (
  <Suspense
    fallback={
      <Spin tip="Loading..." size="large">
        <div className={style.spin}></div>
      </Spin>
    }
  >
    <PipelineEditor currentNode={currentNode} />
  </Suspense>
);
