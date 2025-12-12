import style from "../../../styles/FieldPanel.module.less";
import { memo, useMemo, useCallback, lazy, Suspense } from "react";
import { Popover, Input, Select, Spin } from "antd";
import classNames from "classnames";
import { useFlowStore, type PipelineNodeType } from "../../../stores/flow";
import {
  recoFields,
  actionFields,
  otherFieldParams,
} from "../../../core/fields";
import { JsonHelper } from "../../../utils/jsonHelper";
import { AddFieldElem, ParamFieldListElem } from "../field-items";

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
