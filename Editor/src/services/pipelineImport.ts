import { useFileStore } from "../stores/fileStore";
import { useDocumentStore } from "../stores/documentStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { refreshPipelineDocumentProjection } from "../features/pipeline-document/pipelineDocumentService";

export interface ImportPipelineDraftOptions {
  content: string;
  suggestedName?: string;
  savedBaseline?: boolean;
}

export async function importPipelineAsDraft({
  content,
  suggestedName,
  savedBaseline = false,
}: ImportPipelineDraftOptions): Promise<boolean> {
  const fileStore = useFileStore.getState();
  const previousFileName = fileStore.currentFile.fileName;
  const newFileName = fileStore.addFile({ isSwitch: true });
  if (!newFileName) return false;

  try {
    if (suggestedName) {
      const displayName = suggestedName.replace(/\.(json|jsonc)$/i, "");
      useFileStore.getState().setFileName(displayName);
    }
    const current = useFileStore.getState().currentFile;
    const extension = suggestedName?.toLowerCase().endsWith(".jsonc")
      ? "jsonc"
      : "json";
    const name = `${current.fileName}.${extension}`;
    useProjectSessionStore
      .getState()
      .registerDraft(name, "pipeline", current.documentId);
    useDocumentStore.getState().registerDraft(
      current.documentId,
      {
        path: "",
        name,
        kind: "pipeline",
        language: extension,
        mimeType: extension === "jsonc" ? "application/jsonc" : "application/json",
        size: new TextEncoder().encode(content).length,
        editable: true,
        previewable: true,
      },
      content,
      { saved: savedBaseline },
    );
    useProjectSessionStore.getState().openDocument(current.documentId);
    await refreshPipelineDocumentProjection(current.documentId);
    return true;
  } catch (error) {
    console.error("[pipelineImport] Failed to import draft:", error);
    const store = useFileStore.getState();
    store.removeFile(store.currentFile.fileName);
    if (store.files.some((file) => file.fileName === previousFileName)) {
      useFileStore.getState().switchFile(previousFileName);
    }
    return false;
  }
}
