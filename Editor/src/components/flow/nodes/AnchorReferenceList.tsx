import { ExportOutlined } from "@ant-design/icons";
import classNames from "classnames";
import style from "../../../styles/flow/nodes.module.less";
import type { AnchorReferenceNodeInfo } from "./anchorReferences";

interface AnchorReferenceListProps {
  referenceNodes: AnchorReferenceNodeInfo[];
  canNavigate: boolean;
  onNavigate: (node: AnchorReferenceNodeInfo) => void;
}

function ReferenceDetails({ node }: { node: AnchorReferenceNodeInfo }) {
  return (
    <>
      <div className={style["anchor-ref-node-info"]}>
        <span className={style["anchor-ref-label"]}>{node.label}</span>
        {!node.isCurrentFile && node.relativePath && (
          <span className={style["anchor-ref-file"]}>{node.relativePath}</span>
        )}
      </div>
      <ExportOutlined className={style["anchor-ref-icon"]} />
    </>
  );
}

export function AnchorReferenceList({
  referenceNodes,
  canNavigate,
  onNavigate,
}: AnchorReferenceListProps) {
  return (
    <div className={style["anchor-ref-list"]}>
      {referenceNodes.map((node) => {
        const itemClassName = classNames(style["anchor-ref-item"], {
          [style["anchor-ref-item-interactive"]]: canNavigate,
          [style["anchor-ref-item-readonly"]]: !canNavigate,
        });

        if (!canNavigate) {
          return (
            <div key={node.id} className={itemClassName}>
              <div className={style["anchor-ref-node-info"]}>
                <span className={style["anchor-ref-label"]}>{node.label}</span>
                {!node.isCurrentFile && node.relativePath && (
                  <span className={style["anchor-ref-file"]}>
                    {node.relativePath}
                  </span>
                )}
              </div>
            </div>
          );
        }

        return (
          <button
            key={node.id}
            type="button"
            className={itemClassName}
            aria-label={`跳转到节点 ${node.label}`}
            onClick={() => onNavigate(node)}
          >
            <ReferenceDetails node={node} />
          </button>
        );
      })}
    </div>
  );
}
