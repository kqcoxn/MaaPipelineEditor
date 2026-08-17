import type { EmbedAnchorDefinition } from "@/utils/embedBridge";

export interface AnchorReferenceNodeInfo {
  id: string;
  label: string;
  filePath?: string;
  relativePath?: string;
  isCurrentFile: boolean;
}

interface ResolveAnchorReferencesOptions {
  anchorName: string;
  currentFileName: string | null;
  currentReferences: AnchorReferenceNodeInfo[];
  isEmbed: boolean;
  anchorDefinitions: EmbedAnchorDefinition[];
  getCrossFileReferences: (
    anchorName: string,
  ) => AnchorReferenceNodeInfo[];
}

export function resolveAnchorReferences({
  anchorName,
  currentFileName,
  currentReferences,
  isEmbed,
  anchorDefinitions,
  getCrossFileReferences,
}: ResolveAnchorReferencesOptions): AnchorReferenceNodeInfo[] {
  if (!isEmbed) {
    return [...currentReferences, ...getCrossFileReferences(anchorName)];
  }

  const result: AnchorReferenceNodeInfo[] = [];
  const seen = new Set<string>();
  const addReference = (
    reference: AnchorReferenceNodeInfo,
    fileIdentity: string,
  ) => {
    const key = `${fileIdentity}\u0000${reference.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(reference);
  };

  currentReferences.forEach((reference) => {
    addReference(reference, currentFileName || "<current-file>");
  });

  anchorDefinitions.forEach((definition) => {
    if (definition.anchorName !== anchorName || definition.isCurrentFile) return;
    const fileIdentity = definition.relativePath || definition.fileName;
    addReference(
      {
        id: `${fileIdentity}#${definition.nodeName}`,
        label: definition.nodeName,
        filePath: definition.fileName,
        relativePath: definition.relativePath,
        isCurrentFile: false,
      },
      fileIdentity,
    );
  });

  return result;
}
