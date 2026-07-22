import { pipelineToFlow } from "../core/parser";
import { saveFlow, useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";

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
    const success = await pipelineToFlow({ pString: content });
    if (!success) throw new Error("Pipeline 解析失败");
    saveFlow();
    if (suggestedName) {
      const displayName = suggestedName.replace(/\.(json|jsonc)$/i, "");
      useFileStore.getState().setFileName(displayName);
    }
    if (savedBaseline) useFileStore.getState().markCurrentSaved();
    const current = useFileStore.getState().currentFile;
    useProjectSessionStore.getState().openDocument(current.documentId);
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
