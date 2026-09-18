import type { FileType } from "./fileStore";

// Content baseline includes editor layout but excludes selection and sync metadata.
export function fileSignature(file: FileType): string {
  const content = JSON.stringify({
    nodes: file.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data,
      position: n.position,
    })),
    edges: file.edges.map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      attributes: e.attributes,
    })),
    prefix: file.config.prefix,
    coordinateMode: file.config.coordinateMode,
  });
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < content.length; i++) {
    a = Math.imul(a ^ content.charCodeAt(i), 16777619);
    b = Math.imul(b ^ content.charCodeAt(i), 2246822507);
  }
  return `${content.length}:${a >>> 0}:${b >>> 0}`;
}
export function hasUnsavedContent(file: FileType): boolean {
  if (!file.config.savedContentSignature)
    return Boolean(
      file.config.filePath || file.nodes.length || file.edges.length,
    );
  return fileSignature(file) !== file.config.savedContentSignature;
}
