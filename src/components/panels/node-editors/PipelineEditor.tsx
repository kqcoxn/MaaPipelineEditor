import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback, lazy, Suspense } from "react";
import { Popover, Input, Select, Spin, Modal, InputNumber } from "antd";
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

      // waitFreezes 字段状态判断
      const isWaitFreezesObjectMode = useCallback((value: any): boolean => {
        return (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          Object.keys(value).length > 0
        );
      }, []);

      // pre_wait_freezes
      const currentPreWaitFreezes = useMemo(
        () => currentNode.data.others.pre_wait_freezes,
        [currentNode.data.others.pre_wait_freezes]
      );
      const isPreWaitFreezesObjectMode = useMemo(
        () => isWaitFreezesObjectMode(currentPreWaitFreezes),
        [currentPreWaitFreezes, isWaitFreezesObjectMode]
      );

      // post_wait_freezes
      const currentPostWaitFreezes = useMemo(
        () => currentNode.data.others.post_wait_freezes,
        [currentNode.data.others.post_wait_freezes]
      );
      const isPostWaitFreezesObjectMode = useMemo(
        () => isWaitFreezesObjectMode(currentPostWaitFreezes),
        [currentPostWaitFreezes, isWaitFreezesObjectMode]
      );

      // repeat_wait_freezes
      const currentRepeatWaitFreezes = useMemo(
        () => currentNode.data.others.repeat_wait_freezes,
        [currentNode.data.others.repeat_wait_freezes]
      );
      const isRepeatWaitFreezesObjectMode = useMemo(
        () => isWaitFreezesObjectMode(currentRepeatWaitFreezes),
        [currentRepeatWaitFreezes, isWaitFreezesObjectMode]
      );

      // waitFreezes int 值变更处理
      const handleWaitFreezesIntChange = useCallback(
        (fieldKey: string, value: number | null) => {
          setNodeData(currentNode.id, "others", fieldKey, value ?? 0);
        },
        [currentNode]
      );

      // waitFreezes 添加子字段处理
      const handleWaitFreezesFieldAdd = useCallback(
        (fieldKey: string, param: any) => {
          const currentValue = currentNode.data.others[fieldKey];
          // 有 int 值时提示
          if (
            typeof currentValue === "number" &&
            currentValue !== 0
          ) {
            Modal.confirm({
              title: "切换到结构化模式",
              content: "切换到结构化模式会丢失当前的数值，是否继续?",
              onOk: () => {
                const newValue = { [param.key]: param.default };
                setNodeData(currentNode.id, "others", fieldKey, newValue);
              },
            });
          } else {
            // 直接添加
            const newValue =
              typeof currentValue === "object" && currentValue !== null
                ? { ...currentValue, [param.key]: param.default }
                : { [param.key]: param.default };
            setNodeData(currentNode.id, "others", fieldKey, newValue);
          }
        },
        [currentNode]
      );

      // 通用的 waitFreezes 子字段变更处理
      const handleWaitFreezesFieldChange = useCallback(
        (fieldKey: string, key: string, value: any) => {
          const currentValue = currentNode.data.others[fieldKey];
          if (typeof currentValue === "object" && currentValue !== null) {
            const newValue = { ...currentValue, [key]: value };
            setNodeData(currentNode.id, "others", fieldKey, newValue);
          }
        },
        [currentNode]
      );

      // 通用的 waitFreezes 子字段删除处理
      const handleWaitFreezesFieldDelete = useCallback(
        (fieldKey: string, key: string) => {
          const currentValue = currentNode.data.others[fieldKey];
          if (typeof currentValue === "object" && currentValue !== null) {
            const newValue = { ...currentValue };
            delete newValue[key];
            // 回退到 int 模式
            if (Object.keys(newValue).length === 0) {
              setNodeData(currentNode.id, "others", fieldKey, 0);
            } else {
              setNodeData(currentNode.id, "others", fieldKey, newValue);
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
          {/* pre_wait_freezes 字段 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"pre_wait_freezes"}
              content={otherFieldSchema.preWaitFreezes.desc}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                pre_wait_freezes
              </div>
            </Popover>
            {isPreWaitFreezesObjectMode ? (
              <>
                <div className={classNames([style.value, style.line])}>
                  ————————————
                </div>
                {currentNode && otherFieldSchema.preWaitFreezes.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.preWaitFreezes.params}
                    paramData={
                      typeof currentPreWaitFreezes === "object" &&
                      currentPreWaitFreezes !== null
                        ? currentPreWaitFreezes
                        : {}
                    }
                    onClick={(param) =>
                      handleWaitFreezesFieldAdd("pre_wait_freezes", param)
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className={style.value}>
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="等待时间(毫秒)，或点击右侧添加详细参数"
                    value={
                      typeof currentPreWaitFreezes === "number"
                        ? currentPreWaitFreezes
                        : 0
                    }
                    onChange={(value) =>
                      handleWaitFreezesIntChange("pre_wait_freezes", value)
                    }
                  />
                </div>
                {currentNode && otherFieldSchema.preWaitFreezes.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.preWaitFreezes.params}
                    paramData={{}}
                    onClick={(param) =>
                      handleWaitFreezesFieldAdd("pre_wait_freezes", param)
                    }
                  />
                ) : null}
              </>
            )}
          </div>
          {/* pre_wait_freezes 子字段 */}
          {isPreWaitFreezesObjectMode && currentNode ? (
            <ParamFieldListElem
              paramData={
                typeof currentPreWaitFreezes === "object" &&
                currentPreWaitFreezes !== null
                  ? currentPreWaitFreezes
                  : {}
              }
              paramType={otherFieldSchema.preWaitFreezes.params || []}
              onChange={(key, value) =>
                handleWaitFreezesFieldChange("pre_wait_freezes", key, value)
              }
              onDelete={(key) =>
                handleWaitFreezesFieldDelete("pre_wait_freezes", key)
              }
              onListChange={() => {}}
              onListAdd={() => {}}
              onListDelete={() => {}}
            />
          ) : null}
          {/* post_wait_freezes 字段 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"post_wait_freezes"}
              content={otherFieldSchema.postWaitFreezes.desc}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                post_wait_freezes
              </div>
            </Popover>
            {isPostWaitFreezesObjectMode ? (
              <>
                <div className={classNames([style.value, style.line])}>
                  ————————————
                </div>
                {currentNode && otherFieldSchema.postWaitFreezes.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.postWaitFreezes.params}
                    paramData={
                      typeof currentPostWaitFreezes === "object" &&
                      currentPostWaitFreezes !== null
                        ? currentPostWaitFreezes
                        : {}
                    }
                    onClick={(param) =>
                      handleWaitFreezesFieldAdd("post_wait_freezes", param)
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className={style.value}>
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="等待时间(毫秒)，或点击右侧添加详细参数"
                    value={
                      typeof currentPostWaitFreezes === "number"
                        ? currentPostWaitFreezes
                        : 0
                    }
                    onChange={(value) =>
                      handleWaitFreezesIntChange("post_wait_freezes", value)
                    }
                  />
                </div>
                {currentNode && otherFieldSchema.postWaitFreezes.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.postWaitFreezes.params}
                    paramData={{}}
                    onClick={(param) =>
                      handleWaitFreezesFieldAdd("post_wait_freezes", param)
                    }
                  />
                ) : null}
              </>
            )}
          </div>
          {/* post_wait_freezes 子字段 */}
          {isPostWaitFreezesObjectMode && currentNode ? (
            <ParamFieldListElem
              paramData={
                typeof currentPostWaitFreezes === "object" &&
                currentPostWaitFreezes !== null
                  ? currentPostWaitFreezes
                  : {}
              }
              paramType={otherFieldSchema.postWaitFreezes.params || []}
              onChange={(key, value) =>
                handleWaitFreezesFieldChange("post_wait_freezes", key, value)
              }
              onDelete={(key) =>
                handleWaitFreezesFieldDelete("post_wait_freezes", key)
              }
              onListChange={() => {}}
              onListAdd={() => {}}
              onListDelete={() => {}}
            />
          ) : null}
          {/* repeat_wait_freezes 字段 */}
          <div className={style.item}>
            <Popover
              placement="left"
              title={"repeat_wait_freezes"}
              content={otherFieldSchema.repeatWaitFreezes.desc}
            >
              <div className={classNames([style.key, style["head-key"]])}>
                repeat_wait_freezes
              </div>
            </Popover>
            {isRepeatWaitFreezesObjectMode ? (
              <>
                <div className={classNames([style.value, style.line])}>
                  ————————————
                </div>
                {currentNode && otherFieldSchema.repeatWaitFreezes.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.repeatWaitFreezes.params}
                    paramData={
                      typeof currentRepeatWaitFreezes === "object" &&
                      currentRepeatWaitFreezes !== null
                        ? currentRepeatWaitFreezes
                        : {}
                    }
                    onClick={(param) =>
                      handleWaitFreezesFieldAdd("repeat_wait_freezes", param)
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className={style.value}>
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="等待时间(毫秒)，或点击右侧添加详细参数"
                    value={
                      typeof currentRepeatWaitFreezes === "number"
                        ? currentRepeatWaitFreezes
                        : 0
                    }
                    onChange={(value) =>
                      handleWaitFreezesIntChange("repeat_wait_freezes", value)
                    }
                  />
                </div>
                {currentNode && otherFieldSchema.repeatWaitFreezes.params ? (
                  <AddFieldElem
                    paramType={otherFieldSchema.repeatWaitFreezes.params}
                    paramData={{}}
                    onClick={(param) =>
                      handleWaitFreezesFieldAdd("repeat_wait_freezes", param)
                    }
                  />
                ) : null}
              </>
            )}
          </div>
          {/* repeat_wait_freezes 子字段 */}
          {isRepeatWaitFreezesObjectMode && currentNode ? (
            <ParamFieldListElem
              paramData={
                typeof currentRepeatWaitFreezes === "object" &&
                currentRepeatWaitFreezes !== null
                  ? currentRepeatWaitFreezes
                  : {}
              }
              paramType={otherFieldSchema.repeatWaitFreezes.params || []}
              onChange={(key, value) =>
                handleWaitFreezesFieldChange("repeat_wait_freezes", key, value)
              }
              onDelete={(key) =>
                handleWaitFreezesFieldDelete("repeat_wait_freezes", key)
              }
              onListChange={() => {}}
              onListAdd={() => {}}
              onListDelete={() => {}}
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
