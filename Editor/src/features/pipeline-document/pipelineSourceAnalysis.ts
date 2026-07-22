import {
  parse,
  parseTree,
  printParseErrorCode,
  type Node as JsoncNode,
  type ParseError,
} from "jsonc-parser";

import {
  actionFieldSchemaKeyList,
  actionParamKeys,
  otherFieldSchemaKeyList,
  recoFieldSchemaKeyList,
  recoParamKeys,
} from "../../core/fields";

import type {
  DocumentDiagnostic,
  PipelineSupportLevel,
} from "../../stores/documentStore";
import type {
  PipelineSourceLocation,
  PipelineSourceMap,
} from "./types";

export interface PipelineSourceAnalysis {
  root?: JsoncNode;
  value?: Record<string, unknown>;
  sourceMap?: PipelineSourceMap;
  diagnostics: DocumentDiagnostic[];
  syntaxValid: boolean;
}

const graphFields = new Set(["next", "on_error"]);
const supportedNodeFields = new Set([
  "recognition",
  "action",
  "next",
  "on_error",
  "interrupt",
  "is_sub",
  ...recoFieldSchemaKeyList,
  ...actionFieldSchemaKeyList,
  ...otherFieldSchemaKeyList,
]);

export function analyzePipelineSource(text: string): PipelineSourceAnalysis {
  // jsonc-parser treats a BOM as an invalid symbol. Replacing it with whitespace
  // keeps every source offset aligned with the untouched working text.
  const parseText = text.startsWith("\uFEFF") ? ` ${text.slice(1)}` : text;
  const parseErrors: ParseError[] = [];
  const root = parseTree(parseText, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const diagnostics = parseErrors.map(parseErrorDiagnostic);
  if (!root || parseErrors.length > 0) {
    return { root, diagnostics, syntaxValid: false };
  }

  const sourceMap = buildSourceMap(root);
  const value = parse(parseText, [], {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;
  if (!isRecord(value)) {
    diagnostics.push(
      diagnostic(
        "pipeline.root.object_required",
        "Pipeline 顶层必须是对象",
        root.offset,
        root.length,
        [],
        "graph-unsupported",
        "error",
      ),
    );
    return { root, sourceMap, diagnostics, syntaxValid: true };
  }

  inspectObject(root, [], diagnostics);
  return { root, value, sourceMap, diagnostics, syntaxValid: true };
}

function buildSourceMap(root: JsoncNode): PipelineSourceMap {
  const locations: PipelineSourceLocation[] = [];
  collectLocations(root, [], locations);
  return { locations };
}

function collectLocations(
  node: JsoncNode,
  path: Array<string | number>,
  output: PipelineSourceLocation[],
  key?: JsoncNode,
): void {
  output.push({
    path,
    value: { offset: node.offset, length: node.length },
    key: key ? { offset: key.offset, length: key.length } : undefined,
  });
  if (node.type === "object") {
    node.children?.forEach((property) => {
      const [propertyKey, propertyValue] = property.children ?? [];
      if (!propertyKey || !propertyValue || typeof propertyKey.value !== "string") return;
      collectLocations(propertyValue, [...path, propertyKey.value], output, propertyKey);
    });
    return;
  }
  if (node.type === "array") {
    node.children?.forEach((child, index) => {
      collectLocations(child, [...path, index], output);
    });
  }
}

function inspectObject(
  node: JsoncNode,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  if (node.type !== "object") return;
  const seen = new Set<string>();
  node.children?.forEach((property) => {
    const [keyNode, valueNode] = property.children ?? [];
    if (!keyNode || !valueNode || typeof keyNode.value !== "string") return;
    const key = keyNode.value;
    const propertyPath = [...path, key];
    if (seen.has(key)) {
      diagnostics.push(
        diagnostic(
          "pipeline.duplicate_key",
          `重复字段“${key}”会使画布语义不明确`,
          keyNode.offset,
          keyNode.length,
          propertyPath,
          "graph-unsupported",
          "error",
        ),
      );
    }
    seen.add(key);

    if (path.length === 0) {
      inspectRootProperty(key, valueNode, propertyPath, diagnostics);
    } else if (path.length === 1) {
      inspectNodeProperty(key, valueNode, propertyPath, diagnostics);
    }
    if (valueNode.type === "object") {
      inspectObject(valueNode, propertyPath, diagnostics);
    } else if (valueNode.type === "array") {
      inspectArrayObjects(valueNode, propertyPath, diagnostics);
    }
  });
}

function inspectArrayObjects(
  node: JsoncNode,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  node.children?.forEach((child, index) => {
    if (child.type === "object") inspectObject(child, [...path, index], diagnostics);
  });
}

function inspectRootProperty(
  key: string,
  valueNode: JsoncNode,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  if (key.startsWith("$")) {
    diagnostics.push(
      diagnostic(
        "pipeline.source_only.root_field",
        `根字段“${key}”仅在源码中保留`,
        valueNode.offset,
        valueNode.length,
        path,
        "preserved",
        "info",
      ),
    );
    return;
  }
  if (valueNode.type !== "object") {
    diagnostics.push(
      diagnostic(
        "pipeline.node.object_required",
        `节点“${key}”必须是对象`,
        valueNode.offset,
        valueNode.length,
        path,
        "graph-unsupported",
        "error",
      ),
    );
  }
}

function inspectNodeProperty(
  key: string,
  valueNode: JsoncNode,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  if (graphFields.has(key)) {
    inspectNodeReferences(valueNode, path, diagnostics);
    return;
  }
  if (key === "recognition" || key === "action") {
    inspectTypedField(key, valueNode, path, diagnostics);
    return;
  }
  if (!supportedNodeFields.has(key) || key.startsWith("$")) {
    diagnostics.push(
      diagnostic(
        "pipeline.source_only.node_field",
        `扩展字段“${key}”仅在源码中保留`,
        valueNode.offset,
        valueNode.length,
        path,
        "preserved",
        "info",
      ),
    );
  }
}

function inspectTypedField(
  field: "recognition" | "action",
  node: JsoncNode,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  if (node.type === "string") return;
  if (node.type !== "object") {
    diagnostics.push(invalidTypedFieldDiagnostic(field, node, path));
    return;
  }
  const typeNode = findPropertyValue(node, "type");
  if (typeNode?.type !== "string" || !typeNode.value) {
    diagnostics.push(invalidTypedFieldDiagnostic(field, node, path));
    return;
  }
  const paramNode = findPropertyValue(node, "param");
  if (paramNode && paramNode.type !== "object") {
    diagnostics.push(
      diagnostic(
        "pipeline.node.param.object_required",
        `${field}.param 必须是对象`,
        paramNode.offset,
        paramNode.length,
        [...path, "param"],
        "graph-unsupported",
        "error",
      ),
    );
    return;
  }
  const knownParams =
    field === "recognition"
      ? recoParamKeys[String(typeNode.value)]?.all
      : actionParamKeys[String(typeNode.value)]?.all;
  if (!knownParams) {
    diagnostics.push(
      diagnostic(
        "pipeline.node.type.unsupported",
        `画布暂不支持 ${field} 类型“${String(typeNode.value)}”`,
        typeNode.offset,
        typeNode.length,
        [...path, "type"],
        "graph-unsupported",
        "error",
      ),
    );
  }
  inspectObjectExtensions(node, new Set(["type", "param"]), path, diagnostics);
  if (paramNode?.type === "object") {
    inspectObjectExtensions(
      paramNode,
      new Set(knownParams ?? []),
      [...path, "param"],
      diagnostics,
    );
  }
}

function inspectObjectExtensions(
  node: JsoncNode,
  knownKeys: Set<string>,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  node.children?.forEach((property) => {
    const [keyNode, valueNode] = property.children ?? [];
    if (!keyNode || !valueNode || typeof keyNode.value !== "string") return;
    if (knownKeys.has(keyNode.value)) return;
    diagnostics.push(
      diagnostic(
        "pipeline.source_only.unknown_parameter",
        `未知参数“${keyNode.value}”仅在源码中保留`,
        valueNode.offset,
        valueNode.length,
        [...path, keyNode.value],
        "preserved",
        "info",
      ),
    );
  });
}

function findPropertyValue(node: JsoncNode, key: string): JsoncNode | undefined {
  return node.children?.find(
    (property) => property.children?.[0]?.value === key,
  )?.children?.[1];
}

function invalidTypedFieldDiagnostic(
  field: "recognition" | "action",
  node: JsoncNode,
  path: Array<string | number>,
): DocumentDiagnostic {
  return diagnostic(
    "pipeline.node.typed_field.invalid",
    `${field} 必须是字符串或包含非空 type 的对象`,
    node.offset,
    node.length,
    path,
    "graph-unsupported",
    "error",
  );
}

function inspectNodeReferences(
  node: JsoncNode,
  path: Array<string | number>,
  diagnostics: DocumentDiagnostic[],
): void {
  const references = node.type === "array" ? (node.children ?? []) : [node];
  references.forEach((reference, index) => {
    const referencePath = node.type === "array" ? [...path, index] : path;
    if (reference.type === "string") return;
    if (reference.type !== "object") {
      diagnostics.push(invalidReferenceDiagnostic(reference, referencePath));
      return;
    }
    const nameProperty = reference.children?.find(
      (property) => property.children?.[0]?.value === "name",
    );
    const nameValue = nameProperty?.children?.[1];
    if (nameValue?.type !== "string" || !nameValue.value) {
      diagnostics.push(invalidReferenceDiagnostic(reference, referencePath));
      return;
    }
    const invalidAttribute = reference.children?.some((property) => {
      const [keyNode, valueNode] = property.children ?? [];
      if (!keyNode || !valueNode || typeof keyNode.value !== "string") return true;
      if (keyNode.value === "name") return valueNode.type !== "string";
      if (keyNode.value === "jump_back" || keyNode.value === "anchor") {
        return valueNode.type !== "boolean";
      }
      return true;
    });
    if (invalidAttribute) diagnostics.push(invalidReferenceDiagnostic(reference, referencePath));
  });
}

function invalidReferenceDiagnostic(
  node: JsoncNode,
  path: Array<string | number>,
): DocumentDiagnostic {
  return diagnostic(
    "pipeline.reference.invalid",
    "节点引用必须是字符串或包含非空 name 的对象",
    node.offset,
    node.length,
    path,
    "graph-unsupported",
    "error",
  );
}

function parseErrorDiagnostic(error: ParseError): DocumentDiagnostic {
  const code = printParseErrorCode(error.error);
  const message = `JSONC 语法错误：${code}`;
  return diagnostic(
    `pipeline.syntax.${code}`,
    message,
    error.offset,
    Math.max(error.length, 1),
    [],
    "unparseable",
    "error",
  );
}

function diagnostic(
  code: string,
  message: string,
  offset: number,
  length: number,
  path: Array<string | number>,
  supportLevel: PipelineSupportLevel,
  severity: DocumentDiagnostic["severity"],
): DocumentDiagnostic {
  return { code, message, offset, length, path, supportLevel, severity };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
