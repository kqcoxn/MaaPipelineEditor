import type { DocumentId, ProjectEntry } from "./types";
import { useProjectSessionStore } from "../../stores/projectSessionStore";

export interface ProjectPipelineNodeIndex {
  label: string;
  prefix: string;
  anchors: string[];
}

export interface ProjectPipelineFileIndex {
  document_id: DocumentId;
  file_path: string;
  file_name: string;
  relative_path: string;
  nodes: ProjectPipelineNodeIndex[];
  prefix: string;
  index_status: "pending" | "ready" | "error";
  is_default_pipeline: boolean;
}

export function selectProjectPipelineFiles(
  entriesByPath: Record<string, ProjectEntry>,
): ProjectPipelineFileIndex[] {
  return Object.values(entriesByPath)
    .filter(
      (entry): entry is ProjectEntry & { documentId: DocumentId } =>
        entry.entryKind === "file" && Boolean(entry.pipeline && entry.documentId),
    )
    .map((entry) => ({
      document_id: entry.documentId,
      file_path: entry.path,
      file_name: entry.name,
      relative_path: entry.path,
      nodes: (entry.pipeline?.nodes ?? []) as unknown as ProjectPipelineNodeIndex[],
      prefix: entry.pipeline?.prefix ?? "",
      index_status: entry.pipeline?.indexStatus ?? "pending",
      is_default_pipeline: entry.pipeline?.isDefaultPipeline ?? false,
    }));
}

export function getProjectPipelineFiles(): ProjectPipelineFileIndex[] {
  return selectProjectPipelineFiles(
    useProjectSessionStore.getState().entriesByPath,
  );
}
