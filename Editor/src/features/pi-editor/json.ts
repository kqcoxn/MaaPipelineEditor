import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree, printParseErrorCode, type JSONPath, type Node, type ParseError } from 'jsonc-parser';
export function readJson(content: string): { value: Record<string, unknown>; tree?: Node; error?: string } {
  const errors: ParseError[] = [];
  const tree = parseTree(content, errors, { allowTrailingComma: true });
  if (errors.length) {
    const error = errors[0];
    const lines = content.slice(0, error.offset).split('\n');
    return { value: {}, error: `第 ${lines.length} 行，第 ${lines.at(-1)!.length + 1} 列：${printParseErrorCode(error.error)}` };
  }
  if (!tree || tree.type !== 'object') return { value: {}, error: '文件根值必须是对象' };
  return { value: getNodeValue(tree), tree };
}
export function pointerPath(pointer: string): JSONPath {
  return pointer ? pointer.slice(1).split('/').map(v => v.replace(/~1/g, '/').replace(/~0/g, '~')) : [];
}
export function jsonPath(content: string, pointer: string): JSONPath {
  let node = readJson(content).tree;
  const parts = pointerPath(pointer);
  const arrays = ['task', 'controller', 'resource', 'group', 'preset', 'setting', 'pretask', 'cases', 'inputs', 'hotkeys', 'import', 'path', 'attach_resource_path'];
  return parts.map((part, index) => {
    const key = node?.type === 'array' || (!node && arrays.includes(String(parts[index - 1])) && /^\d+$/.test(String(part))) ? Number(part) : part;
    node = node ? findNodeAtLocation(node, [key]) : undefined;
    return key;
  });
}
export const escapePointer = (name: string) => name.replace(/~/g, '~0').replace(/\//g, '~1');
export function valueAt(content: string, pointer: string): unknown {
  const { tree } = readJson(content);
  const node = tree && findNodeAtLocation(tree, jsonPath(content, pointer));
  return node ? getNodeValue(node) : undefined;
}
export function editJson(content: string, pointer: string, value: unknown): string {
  const parsed = readJson(content);
  if (parsed.error) throw new Error(parsed.error);
  const indentation = content.match(/\n([\t ]+)\S/)?.[1] ?? '  ';
  return applyEdits(content, modify(content, jsonPath(content, pointer), value, { formattingOptions: { insertSpaces: !indentation.includes('\t'), tabSize: indentation.includes('\t') ? 1 : indentation.length, eol: content.includes('\r\n') ? '\r\n' : '\n' } }));
}
// Renaming object keys must preserve the definition body and its comments.
export function renameKey(content: string, pointer: string, name: string): string {
  const { tree } = readJson(content);
  const node = tree && findNodeAtLocation(tree, jsonPath(content, pointer));
  const property = node?.parent;
  if (property?.type !== 'property') throw new Error('无法定位定义');
  const key = property.children![0];
  return content.slice(0, key.offset) + JSON.stringify(name) + content.slice(key.offset + key.length);
}
// Reorder values by replacing their raw spans, retaining comments inside each value.
export function reorderJson(content: string, pointer: string, from: number, to: number): string {
  const { tree } = readJson(content);
  const array = tree && findNodeAtLocation(tree, jsonPath(content, pointer));
  const children = array?.children;
  if (array?.type !== 'array' || !children || !children[from] || !children[to]) return content;
  const values = children.map(n => content.slice(n.offset, n.offset + n.length));
  const reordered = [...values]; reordered.splice(to, 0, reordered.splice(from, 1)[0]);
  for (let i = children.length - 1; i >= 0; i--) content = content.slice(0, children[i].offset) + reordered[i] + content.slice(children[i].offset + children[i].length);
  return content;
}
export function rawAt(content: string, pointer: string): string {
  const { tree } = readJson(content);
  const node = tree && findNodeAtLocation(tree, jsonPath(content, pointer));
  if (!node) throw new Error('无法定位内容');
  return content.slice(node.offset, node.offset + node.length);
}
export function insertRaw(content: string, pointer: string, raw: string): string {
  const updated = editJson(content, pointer, null);
  const { tree } = readJson(updated);
  const node = tree && findNodeAtLocation(tree, jsonPath(updated, pointer));
  if (!node) throw new Error('无法插入内容');
  return updated.slice(0, node.offset) + raw + updated.slice(node.offset + node.length);
}
