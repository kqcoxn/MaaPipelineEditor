import { findNodeAtOffset, parseTree, type Node } from "jsonc-parser";
import { languages, type editor } from "monaco-editor";
import {
  recoFields,
  actionFields,
  otherFieldSchemaKeyList,
  recoParamKeys,
  actionParamKeys,
} from "../../core/fields";

interface Position {
  lineNumber: number;
  column: number;
}

export interface MfwJsonNodeNameSuggestion {
  label: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

interface MfwJsonCompletionContext {
  nodeNameSuggestions?: MfwJsonNodeNameSuggestion[];
}

let mfwJsonCompletionRegistered = false;
const modelCompletionContext = new WeakMap<
  editor.ITextModel,
  MfwJsonCompletionContext
>();

function getRecognitionTypes(): string[] {
  return Object.keys(recoFields).sort();
}

function getActionTypes(): string[] {
  return Object.keys(actionFields).sort();
}

function getRecognitionFieldKeys(recognitionType: string): string[] {
  return recoParamKeys[recognitionType]?.all || [];
}

function getActionFieldKeys(actionType: string): string[] {
  return actionParamKeys[actionType]?.all || [];
}

function getTopLevelFields(): string[] {
  const specialTopLevelFields = ["recognition", "action", "next", "on_error"];
  return [...specialTopLevelFields, ...otherFieldSchemaKeyList].sort();
}

function parseContext(
  model: editor.ITextModel,
  position: Position,
): { recognition?: string; action?: string } {
  const root = parseTree(model.getValue());
  if (!root) {
    return {};
  }

  const offset = Math.max(0, model.getOffsetAt(position) - 1);
  const objectNode =
    findNearestObjectNode(findNodeAtOffset(root, offset, true)) ??
    findNearestObjectNode(findNodeAtOffset(root, offset + 1, true));
  if (!objectNode) {
    return {};
  }

  return extractObjectContext(objectNode);
}

function findNearestObjectNode(node: Node | undefined): Node | undefined {
  let current = node;
  while (current) {
    if (current.type === "object") {
      return current;
    }
    if (
      current.type === "property" &&
      current.children?.[1]?.type === "object"
    ) {
      return current.children[1];
    }
    current = current.parent;
  }
  return undefined;
}

function extractObjectContext(node: Node): {
  recognition?: string;
  action?: string;
} {
  const result: { recognition?: string; action?: string } = {};
  for (const property of node.children ?? []) {
    if (property.type !== "property") {
      continue;
    }
    const [keyNode, valueNode] = property.children ?? [];
    const key = typeof keyNode?.value === "string" ? keyNode.value : undefined;
    if (key === "recognition" && typeof valueNode?.value === "string") {
      result.recognition = valueNode.value;
    }
    if (key === "action" && typeof valueNode?.value === "string") {
      result.action = valueNode.value;
    }
  }
  return result;
}

function getCurrentNode(
  root: Node,
  model: editor.ITextModel,
  position: Position,
): Node | undefined {
  const offset = Math.max(0, model.getOffsetAt(position) - 1);
  return (
    findNodeAtOffset(root, offset, true) ??
    findNodeAtOffset(root, offset + 1, true)
  );
}

function findNearestPropertyNode(node: Node | undefined): Node | undefined {
  let current = node;
  while (current) {
    if (current.type === "property") {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

function getPropertyKey(node: Node | undefined): string | undefined {
  const keyNode = node?.children?.[0];
  return typeof keyNode?.value === "string" ? keyNode.value : undefined;
}

function getObjectDepth(node: Node): number {
  let depth = 0;
  let current = node.parent;
  while (current) {
    if (current.type === "object") {
      depth += 1;
    }
    current = current.parent;
  }
  return depth;
}

function checkPropertyValueContext(
  model: editor.ITextModel,
  position: Position,
): { isInRecognitionValue: boolean; isInActionValue: boolean } {
  const lineContent = model.getLineContent(position.lineNumber);
  const textUntilPosition = lineContent.substring(0, position.column - 1);

  return {
    isInRecognitionValue: /"recognition"\s*:\s*"[^"]*$/.test(textUntilPosition),
    isInActionValue: /"action"\s*:\s*"[^"]*$/.test(textUntilPosition),
  };
}

function createCompletionRange(
  position: Position,
  currentInput: string,
) {
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: position.column - currentInput.length,
    endColumn: position.column,
  };
}

function createNodeNameFieldSuggestions(
  nodeNames: MfwJsonNodeNameSuggestion[],
  currentInput: string,
  position: Position,
): languages.CompletionItem[] {
  const range = createCompletionRange(position, currentInput);
  return nodeNames.map((item) => ({
    label: item.label,
    kind: languages.CompletionItemKind.Field,
    insertText: item.insertText ?? item.label,
    detail: item.detail ?? "运行时节点名",
    documentation: item.documentation,
    sortText: item.label.startsWith(currentInput) ? `0${item.label}` : `1${item.label}`,
    range,
  }));
}

function createNodeNameValueSuggestions(
  nodeNames: MfwJsonNodeNameSuggestion[],
  currentInput: string,
  position: Position,
): languages.CompletionItem[] {
  const range = createCompletionRange(position, currentInput);
  return nodeNames.map((item) => ({
    label: item.label,
    kind: languages.CompletionItemKind.Value,
    insertText: item.insertText ?? item.label,
    detail: item.detail ?? "运行时节点名",
    documentation: item.documentation,
    sortText: item.label.startsWith(currentInput) ? `0${item.label}` : `1${item.label}`,
    range,
  }));
}

function mergeSuggestions(
  ...groups: languages.CompletionItem[][]
): languages.CompletionItem[] {
  const merged = new Map<string, languages.CompletionItem>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.kind}:${String(item.label)}`;
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    }
  }
  return Array.from(merged.values());
}

function isTopLevelKeyContext(
  root: Node | undefined,
  model: editor.ITextModel,
  position: Position,
): boolean {
  if (!root) {
    return false;
  }
  const currentNode = getCurrentNode(root, model, position);
  const objectNode = findNearestObjectNode(currentNode);
  return Boolean(objectNode && getObjectDepth(objectNode) === 0);
}

function isNodeReferenceValueContext(
  root: Node | undefined,
  model: editor.ITextModel,
  position: Position,
): boolean {
  if (!root) {
    return false;
  }
  const currentNode = getCurrentNode(root, model, position);
  const propertyKey = getPropertyKey(findNearestPropertyNode(currentNode));
  return propertyKey === "next" || propertyKey === "on_error";
}

export function createMfwCompletionProvider(): languages.CompletionItemProvider {
  return {
    triggerCharacters: ['"', "'"],
    provideCompletionItems: (model, position): languages.CompletionList => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilPosition = lineContent.substring(0, position.column - 1);
      const match = textUntilPosition.match(/["']([^"']*)$/);
      const currentInput = match ? match[1] : "";
      const root = parseTree(model.getValue());
      const nodeNameSuggestions =
        modelCompletionContext.get(model)?.nodeNameSuggestions ?? [];
      const { isInRecognitionValue, isInActionValue } =
        checkPropertyValueContext(model, position);

      if (isInRecognitionValue) {
        const suggestions: languages.CompletionItem[] = getRecognitionTypes().map(
          (type) => ({
            label: type,
            kind: languages.CompletionItemKind.Value,
            insertText: type,
            detail: `识别类型: ${recoFields[type]?.desc?.split("。")[0] || ""}`,
            documentation: recoFields[type]?.desc || "",
            sortText: type.toLowerCase().startsWith(currentInput.toLowerCase())
              ? `0${type}`
              : `1${type}`,
            range: createCompletionRange(position, currentInput),
          }),
        );
        return { suggestions };
      }

      if (isInActionValue) {
        const suggestions: languages.CompletionItem[] = getActionTypes().map(
          (type) => ({
            label: type,
            kind: languages.CompletionItemKind.Value,
            insertText: type,
            detail: `动作类型: ${actionFields[type]?.desc?.split("。")[0] || ""}`,
            documentation: actionFields[type]?.desc || "",
            sortText: type.toLowerCase().startsWith(currentInput.toLowerCase())
              ? `0${type}`
              : `1${type}`,
            range: createCompletionRange(position, currentInput),
          }),
        );
        return { suggestions };
      }

      if (
        nodeNameSuggestions.length > 0 &&
        isNodeReferenceValueContext(root, model, position)
      ) {
        return {
          suggestions: createNodeNameValueSuggestions(
            nodeNameSuggestions,
            currentInput,
            position,
          ),
        };
      }

      const isInKeyContext = /["'][^"']*$/.test(textUntilPosition);
      const isBeforeColon =
        /["'][^"']*["']?\s*$/.test(textUntilPosition) &&
        !textUntilPosition.includes(":");

      if (!isInKeyContext && !isBeforeColon) {
        return { suggestions: [] };
      }

      const context = parseContext(model, position);
      const fieldKeys = new Set<string>();

      getTopLevelFields().forEach((key) => fieldKeys.add(key));

      if (context.recognition) {
        getRecognitionFieldKeys(context.recognition).forEach((key) =>
          fieldKeys.add(key),
        );
      } else {
        Object.keys(recoFields).forEach((type) => {
          getRecognitionFieldKeys(type).forEach((key) => fieldKeys.add(key));
        });
      }

      if (context.action) {
        getActionFieldKeys(context.action).forEach((key) => fieldKeys.add(key));
      } else {
        Object.keys(actionFields).forEach((type) => {
          getActionFieldKeys(type).forEach((key) => fieldKeys.add(key));
        });
      }

      const suggestions: languages.CompletionItem[] = Array.from(fieldKeys)
        .sort()
        .map((key) => ({
          label: key,
          kind: languages.CompletionItemKind.Field,
          insertText: key,
          detail: "MaaFramework 字段",
          sortText: key.startsWith(currentInput) ? `0${key}` : `1${key}`,
          range: createCompletionRange(position, currentInput),
        }));

      const extraNodeSuggestions =
        nodeNameSuggestions.length > 0 &&
        isTopLevelKeyContext(root, model, position)
          ? createNodeNameFieldSuggestions(
              nodeNameSuggestions,
              currentInput,
              position,
            )
          : [];

      return {
        suggestions: mergeSuggestions(extraNodeSuggestions, suggestions),
      };
    },
  };
}

export function setMfwJsonCompletionContext(
  model: editor.ITextModel,
  context: MfwJsonCompletionContext,
) {
  if (!context.nodeNameSuggestions || context.nodeNameSuggestions.length === 0) {
    modelCompletionContext.delete(model);
    return;
  }
  modelCompletionContext.set(model, {
    nodeNameSuggestions: context.nodeNameSuggestions,
  });
}

export function clearMfwJsonCompletionContext(model: editor.ITextModel) {
  modelCompletionContext.delete(model);
}

export function ensureMfwJsonCompletionProvider(
  monaco: typeof import("monaco-editor"),
) {
  if (mfwJsonCompletionRegistered) {
    return;
  }
  monaco.languages.registerCompletionItemProvider(
    "json",
    createMfwCompletionProvider(),
  );
  mfwJsonCompletionRegistered = true;
}

export function createMfwJsonEditorOptions(
  jsonIndent: number,
  overrides: editor.IStandaloneEditorConstructionOptions = {},
): editor.IStandaloneEditorConstructionOptions {
  return {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "on",
    formatOnPaste: true,
    formatOnType: true,
    lineNumbers: "on",
    renderWhitespace: "selection",
    automaticLayout: true,
    fontSize: 14,
    tabSize: jsonIndent,
    insertSpaces: true,
    // Monaco defaults do not keep quick suggestions active inside JSON strings,
    // which makes our custom key/value completion appear broken while typing.
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    suggestOnTriggerCharacters: true,
    ...overrides,
  };
}
