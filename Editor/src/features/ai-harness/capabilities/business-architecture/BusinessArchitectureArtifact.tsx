import { ApartmentOutlined, RightOutlined } from "@ant-design/icons";
import type { BusinessArchitectureDocument } from "./types";
import style from "@/styles/panels/BusinessArchitecturePanel.module.less";

interface BusinessArchitectureArtifactProps {
  document: BusinessArchitectureDocument;
  onOpen: () => void;
}

export function BusinessArchitectureArtifact({
  document,
  onOpen,
}: BusinessArchitectureArtifactProps) {
  const previewStages = document.stages.slice(0, 4);
  return (
    <button
      type="button"
      className={style.artifactButton}
      onClick={onOpen}
      aria-label={`打开流程架构：${document.title}`}
    >
      <span className={style.artifactPreview} aria-hidden="true">
        {previewStages.map((stage, index) => (
          <span key={stage.id} className={style.artifactPreviewItem}>
            <i data-kind={stage.kind} />
            {index < previewStages.length - 1 && <b />}
          </span>
        ))}
      </span>
      <span className={style.artifactCopy}>
        <span className={style.artifactType}>
          <ApartmentOutlined />
          流程架构
        </span>
        <strong>{document.title}</strong>
        <small>
          {document.stages.length} 个阶段 · {document.coverage.includedNodeCount} 个节点
        </small>
      </span>
      <RightOutlined className={style.artifactArrow} />
    </button>
  );
}
