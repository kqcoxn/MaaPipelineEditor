import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo, useCallback } from "react";
import { Popover, Select, Button, Switch, message } from "antd";
import classNames from "classnames";

import { useConfigStore } from "../../../stores/configStore";
import { useFlowStore } from "../../../stores/flow";
import { HANDLE_DIRECTION_OPTIONS } from "../../flow/nodes/constants";
import type { HandleDirection } from "../../flow/nodes/constants";
import TipElem from "./TipElem";

const PipelineConfigSection = memo(() => {
  const nodeAttrExportStyle = useConfigStore(
    (state) => state.configs.nodeAttrExportStyle
  );
  const defaultHandleDirection = useConfigStore(
    (state) => state.configs.defaultHandleDirection
  );
  const exportDefaultRecoAction = useConfigStore(
    (state) => state.configs.exportDefaultRecoAction
  );
  const setConfig = useConfigStore((state) => state.setConfig);
  const nodes = useFlowStore((state) => state.nodes);
  const setNodes = useFlowStore((state) => state.setNodes);

  const globalClass = useMemo(() => classNames(style.item, style.global), []);

  // 一键更改所有节点端点位置
  const handleApplyToAll = useCallback(() => {
    const newNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        handleDirection:
          defaultHandleDirection === "left-right"
            ? undefined
            : defaultHandleDirection,
      },
    }));
    setNodes(newNodes);
    message.success(
      `已将所有节点端点位置更改为「${
        HANDLE_DIRECTION_OPTIONS.find((o) => o.value === defaultHandleDirection)
          ?.label
      }」`
    );
  }, [nodes, setNodes, defaultHandleDirection]);

  return (
    <>
      <div className={style.divider}>————— Pipeline 配置 —————</div>
      {/* 节点属性导出形式 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"节点属性导出形式"}
            content={
              <TipElem
                content={
                  "对象形式：{ name: 'C', anchor: true, jump_back: true }\n前缀形式：'[Anchor][JumpBack]C'"
                }
              />
            }
          >
            <span>节点属性导出形式</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 90 }}
          value={nodeAttrExportStyle}
          onChange={(value) => setConfig("nodeAttrExportStyle", value)}
          options={[
            { value: "prefix", label: "前缀形式" },
            { value: "object", label: "对象形式" },
          ]}
        />
      </div>
      {/* 默认端点位置 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="默认端点位置"
            content={
              <TipElem
                content={
                  "新创建节点的默认端点位置\n左右：左侧输入，右侧输出（默认）\n右左：右侧输入，左侧输出\n上下：上方输入，下方输出\n下上：下方输入，上方输出"
                }
              />
            }
          >
            <span>默认端点位置</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 70 }}
          value={defaultHandleDirection}
          onChange={(value: HandleDirection) =>
            setConfig("defaultHandleDirection", value)
          }
          options={HANDLE_DIRECTION_OPTIONS}
        />
      </div>
      {/* 一键更改所有节点端点位置 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="一键更改"
            content="将所有节点的端点位置更改为当前选中的默认位置"
          >
            <span>一键更改端点位置</span>
          </Popover>
        </div>
        <Button className={style.value} size="small" onClick={handleApplyToAll}>
          应用到所有节点
        </Button>
      </div>
      {/* 导出默认识别/动作 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="导出默认识别/动作"
            content={
              <TipElem
                content={
                  "关闭时，导出时若节点的识别类型为 DirectHit 且无参数，则不导出 recognition 字段；\n若动作类型为 DoNothing 且无参数，则不导出 action 字段。\n两者独立检测。"
                }
              />
            }
          >
            <span>导出默认识别/动作</span>
          </Popover>
        </div>
        <Switch
          className={style.value}
          style={{ maxWidth: 60 }}
          checked={exportDefaultRecoAction}
          checkedChildren="导出"
          unCheckedChildren="省略"
          onChange={(checked) => setConfig("exportDefaultRecoAction", checked)}
        />
      </div>
    </>
  );
});

export default PipelineConfigSection;
