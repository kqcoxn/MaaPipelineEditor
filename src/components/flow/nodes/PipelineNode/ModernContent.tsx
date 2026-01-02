import { memo, useMemo, useRef, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import IconFont from "../../../iconfonts";
import { KVElem } from "../components/KVElem";
import { getRecognitionIcon, getActionIcon, getNodeTypeIcon } from "../utils";
import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "../constants";
import { JsonHelper } from "../../../../utils/jsonHelper";
import { otherFieldSchema } from "../../../../core/fields/other/schema";

// focus 子项 key 到 displayName 的映射
const focusDisplayNameMap: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  if (otherFieldSchema.focus.params) {
    for (const param of otherFieldSchema.focus.params) {
      if (param.displayName) {
        map[param.key] = param.displayName;
      }
    }
  }
  return map;
})();

/**现代风格Pipeline节点内容 */
export const ModernContent = memo(
  ({ data }: { data: PipelineNodeDataType; props: NodeProps }) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = useState(0);

    useEffect(() => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
      }
    }, [data.label]);

    const ExtrasElem = useMemo(() => {
      if (JsonHelper.isObj(data.extras)) {
        return Object.keys(data.extras).map((key) => (
          <KVElem key={key} paramKey={key} value={data.extras[key]} />
        ));
      }
      const extras = JsonHelper.stringObjToJson(data.extras);
      if (extras) {
        return Object.keys(extras).map((key) => (
          <KVElem key={key} paramKey={key} value={extras[key]} />
        ));
      }
      return null;
    }, [data.extras]);

    // 过滤空的 focus 字段，并将 focus 对象拆分为子项
    const { filteredOthers, focusItems } = useMemo(() => {
      const others = { ...data.others };
      let focusItems: { key: string; value: any }[] = [];

      if ("focus" in others) {
        const focus = others.focus;
        // 空值检测
        if (
          focus === "" ||
          focus === null ||
          focus === undefined ||
          (typeof focus === "object" &&
            focus !== null &&
            Object.keys(focus).length === 0)
        ) {
          delete others.focus;
        } else if (typeof focus === "object" && focus !== null) {
          // 使用 displayName 缩写
          focusItems = Object.keys(focus).map((subKey) => ({
            key: focusDisplayNameMap[subKey] || subKey,
            value: focus[subKey],
          }));
          delete others.focus;
        }
      }

      return { filteredOthers: others, focusItems };
    }, [data.others]);

    const recoIconConfig = useMemo(
      () => getRecognitionIcon(data.recognition.type),
      [data.recognition.type]
    );
    const actionIconConfig = useMemo(
      () => getActionIcon(data.action.type),
      [data.action.type]
    );
    const nodeTypeIconConfig = useMemo(() => getNodeTypeIcon("pipeline"), []);

    const hasRecoParams = useMemo(
      () => Object.keys(data.recognition.param).length > 0,
      [data.recognition.param]
    );
    const hasActionParams = useMemo(
      () => Object.keys(data.action.param).length > 0,
      [data.action.param]
    );
    const hasOtherParams = useMemo(
      () =>
        Object.keys(filteredOthers).length > 0 ||
        focusItems.length > 0 ||
        (ExtrasElem && ExtrasElem.length > 0),
      [filteredOthers, focusItems, ExtrasElem]
    );

    return (
      <>
        {/* 顶部区域 */}
        <div ref={headerRef} className={style.modernHeader}>
          <div className={style.headerLeft}>
            <span title="Pipeline节点">
              <IconFont
                className={style.typeIcon}
                name={nodeTypeIconConfig.name}
                size={nodeTypeIconConfig.size}
              />
            </span>
          </div>
          <div className={style.headerTitle}>{data.label}</div>
          <div className={style.headerRight}>
            <div className={style.moreBtn}>
              <IconFont name="icon-gengduo" size={14} />
            </div>
          </div>
        </div>

        {/* 字段区域 */}
        <div className={style.modernContent}>
          {/* 识别区域 */}
          <div className={style.section}>
            <div className={classNames(style.sectionHeader, style.recoHeader)}>
              {recoIconConfig.name && (
                <IconFont
                  name={recoIconConfig.name}
                  size={recoIconConfig.size}
                />
              )}
              <span>识别 - {data.recognition.type}</span>
            </div>
            {hasRecoParams && (
              <ul className={style.sectionList}>
                {Object.keys(data.recognition.param).map((key) => (
                  <KVElem
                    key={key}
                    paramKey={key}
                    value={data.recognition.param[key]}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* 动作区域 */}
          <div className={style.section}>
            <div
              className={classNames(style.sectionHeader, style.actionHeader)}
            >
              {actionIconConfig.name && (
                <IconFont
                  name={actionIconConfig.name}
                  size={actionIconConfig.size}
                />
              )}
              <span>动作 - {data.action.type}</span>
            </div>
            {hasActionParams && (
              <ul className={style.sectionList}>
                {Object.keys(data.action.param).map((key) => (
                  <KVElem
                    key={key}
                    paramKey={key}
                    value={data.action.param[key]}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* 其他区域 */}
          {hasOtherParams && (
            <div className={style.section}>
              <div
                className={classNames(style.sectionHeader, style.otherHeader)}
              >
                <IconFont name="icon-zidingyi" size={12} />
                <span>其他</span>
              </div>
              <ul className={style.sectionList}>
                {Object.keys(filteredOthers).map((key) => (
                  <KVElem
                    key={key}
                    paramKey={key}
                    value={filteredOthers[key]}
                  />
                ))}
                {focusItems.map((item) => (
                  <KVElem
                    key={item.key}
                    paramKey={item.key}
                    value={item.value}
                  />
                ))}
                {ExtrasElem}
              </ul>
            </div>
          )}
        </div>

        <Handle
          id={TargetHandleTypeEnum.Target}
          className={classNames(style.handle, style.target)}
          type="target"
          position={Position.Left}
        />
        <Handle
          id={TargetHandleTypeEnum.JumpBack}
          className={classNames(style.handle, style.targetJumpback)}
          type="target"
          position={Position.Left}
        />
        <Handle
          id={SourceHandleTypeEnum.Next}
          className={classNames(style.handle, style.next)}
          type="source"
          position={Position.Right}
        />
        <Handle
          id={SourceHandleTypeEnum.Error}
          className={classNames(style.handle, style.error)}
          type="source"
          position={Position.Right}
        />
      </>
    );
  }
);
