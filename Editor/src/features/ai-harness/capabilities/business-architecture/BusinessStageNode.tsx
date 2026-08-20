import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  BranchesOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import type { BusinessStageNode } from "./architectureGraph";
import type { BusinessStageKind } from "./types";
import style from "@/styles/panels/BusinessArchitecturePanel.module.less";

const kindMeta: Record<
  BusinessStageKind,
  { label: string; icon: React.ReactNode }
> = {
  main: { label: "主流程", icon: <RightOutlined /> },
  branch: { label: "业务分支", icon: <BranchesOutlined /> },
  error: { label: "异常恢复", icon: <ExclamationCircleOutlined /> },
  loop: { label: "循环环节", icon: <ReloadOutlined /> },
  support: { label: "辅助流程", icon: <ToolOutlined /> },
};

export const BusinessStageNodeComponent = memo(
  function BusinessStageNodeComponent({ data }: NodeProps<BusinessStageNode>) {
    const { stage } = data;
    const meta = kindMeta[stage.kind];
    return (
      <article
        className={`${style.stageNode} ${style[`stageNode_${stage.kind}`]}`}
        aria-label={`${meta.label}：${stage.title}`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className={style.stageHandle}
          isConnectable={false}
        />
        <header className={style.stageHeader}>
          <span className={style.stageKind}>
            {meta.icon}
            {meta.label}
          </span>
          <span className={style.stageCount}>{stage.nodeIds.length}</span>
        </header>
        <h3>{stage.title}</h3>
        <p>{stage.description}</p>
        <Handle
          type="source"
          position={Position.Right}
          className={style.stageHandle}
          isConnectable={false}
        />
      </article>
    );
  },
);
