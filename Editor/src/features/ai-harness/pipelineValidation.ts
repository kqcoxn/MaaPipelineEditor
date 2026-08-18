import {
  actionFields,
  FieldTypeEnum,
  recoFields,
  type FieldType,
} from "@/core/fields";

export interface PipelineValidationReferences {
  nodeNames: ReadonlySet<string>;
  anchorNames: ReadonlySet<string>;
}

const requiredRecognitionFields: Record<string, string[]> = {
  TemplateMatch: ["template"],
  FeatureMatch: ["template"],
  ColorMatch: ["lower", "upper"],
  NeuralNetworkClassify: ["model"],
  NeuralNetworkDetect: ["model"],
  And: ["all_of"],
  Or: ["any_of"],
  Custom: ["custom_recognition"],
};

const requiredActionFields: Record<string, string[]> = {
  MultiSwipe: ["swipes"],
  ClickKey: ["key"],
  LongPressKey: ["key"],
  KeyDown: ["key"],
  KeyUp: ["key"],
  InputText: ["input_text"],
  StartApp: ["package"],
  StopApp: ["package"],
  Command: ["exec"],
  Shell: ["cmd"],
  Custom: ["custom_action"],
};

interface PipelineSection {
  type: string;
  params: Record<string, unknown>;
  path: string;
}

export function validatePipelineDefinition(
  definition: Record<string, unknown>,
  references?: PipelineValidationReferences,
): string[] {
  const errors: string[] = [];
  const recognition = readSection(
    definition,
    "recognition",
    "DirectHit",
    errors,
  );
  const action = readSection(definition, "action", "DoNothing", errors);

  validateSection(
    recognition,
    recoFields,
    requiredRecognitionFields,
    "识别",
    errors,
  );
  validateSection(action, actionFields, requiredActionFields, "动作", errors);

  if (references) {
    validateSectionReferences(recognition, references, errors);
    validateSectionReferences(action, references, errors);
  }
  validateCompositeRecognitions(recognition, references, errors);

  return [...new Set(errors)];
}

function readSection(
  definition: Record<string, unknown>,
  key: "recognition" | "action",
  defaultType: string,
  errors: string[],
): PipelineSection {
  const value = definition[key];
  if (value === undefined) {
    return { type: defaultType, params: definition, path: key };
  }
  if (typeof value === "string") {
    return { type: value, params: definition, path: key };
  }
  if (!isRecord(value)) {
    errors.push(`${key} 必须是字符串或 { type, param } 对象`);
    return { type: "", params: {}, path: key };
  }
  if (typeof value.type !== "string" || !value.type.trim()) {
    errors.push(`${key}.type 必须是非空字符串`);
  }
  if (value.param !== undefined && !isRecord(value.param)) {
    errors.push(`${key}.param 必须是对象`);
  }
  return {
    type: typeof value.type === "string" ? value.type : "",
    params: isRecord(value.param) ? value.param : {},
    path: `${key}.param`,
  };
}

function validateSection(
  section: PipelineSection,
  fields: typeof recoFields,
  requiredFields: Record<string, string[]>,
  label: string,
  errors: string[],
): void {
  const definition = fields[section.type];
  if (!definition) {
    errors.push(`未知${label}类型: ${section.type || "(空)"}`);
    return;
  }

  const fieldMap = new Map(definition.params.map((field) => [field.key, field]));
  for (const [key, value] of Object.entries(section.params)) {
    const field = fieldMap.get(key);
    if (field && !matchesField(value, field)) {
      errors.push(`${section.path}.${key} 类型不符合 Pipeline 协议`);
    }
  }
  for (const key of requiredFields[section.type] ?? []) {
    if (isMissingRequiredValue(section.params[key])) {
      errors.push(`${section.path}.${key} 是 ${section.type} 的必填参数`);
    }
  }
}

function validateSectionReferences(
  section: PipelineSection,
  references: PipelineValidationReferences,
  errors: string[],
): void {
  for (const key of ["roi", "target", "begin", "end", "color_filter"]) {
    collectStrings(section.params[key]).forEach((reference) => {
      if (!reference) {
        errors.push(`${section.path}.${key} 不能引用空节点`);
        return;
      }
      if (reference.startsWith("[Anchor]")) {
        const anchorName = reference.slice("[Anchor]".length);
        if (!references.anchorNames.has(anchorName)) {
          errors.push(`${section.path}.${key} 引用了未定义锚点: ${anchorName}`);
        }
        return;
      }
      if (!references.nodeNames.has(reference)) {
        errors.push(`${section.path}.${key} 引用了不存在的节点: ${reference}`);
      }
    });
  }
}

function validateCompositeRecognitions(
  section: PipelineSection,
  references: PipelineValidationReferences | undefined,
  errors: string[],
): void {
  const key = section.type === "And" ? "all_of" : section.type === "Or" ? "any_of" : null;
  if (!key || !Array.isArray(section.params[key])) return;
  section.params[key].forEach((item, index) => {
    if (typeof item === "string") {
      if (references && !references.nodeNames.has(item)) {
        errors.push(`${section.path}.${key}[${index}] 引用了不存在的节点: ${item}`);
      }
      return;
    }
    if (isRecord(item)) {
      validatePipelineDefinition(item, references).forEach((error) =>
        errors.push(`${section.path}.${key}[${index}]: ${error}`),
      );
    }
  });
}

function matchesField(value: unknown, field: FieldType): boolean {
  const types = Array.isArray(field.type) ? field.type : [field.type];
  return types.some((type) => matchesType(value, type));
}

function matchesType(value: unknown, type: FieldTypeEnum): boolean {
  const isIntegerArray = (item: unknown): item is number[] =>
    Array.isArray(item) && item.every(Number.isInteger);
  const isNumberArray = (item: unknown): item is number[] =>
    Array.isArray(item) && item.every((value) => typeof value === "number" && Number.isFinite(value));
  const isPosition = (item: unknown): boolean =>
    item === true ||
    typeof item === "string" ||
    (isIntegerArray(item) && (item.length === 2 || item.length === 4));

  switch (type) {
    case FieldTypeEnum.Int:
      return Number.isInteger(value);
    case FieldTypeEnum.Double:
      return typeof value === "number" && Number.isFinite(value);
    case FieldTypeEnum.True:
      return value === true;
    case FieldTypeEnum.Bool:
      return typeof value === "boolean";
    case FieldTypeEnum.String:
    case FieldTypeEnum.ImagePath:
      return typeof value === "string";
    case FieldTypeEnum.IntList:
      return isIntegerArray(value);
    case FieldTypeEnum.IntListList:
      return Array.isArray(value) && value.every(isIntegerArray);
    case FieldTypeEnum.DoubleList:
      return isNumberArray(value);
    case FieldTypeEnum.StringList:
    case FieldTypeEnum.ImagePathList:
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case FieldTypeEnum.XYWH:
      return isIntegerArray(value) && value.length === 4;
    case FieldTypeEnum.XYWHList:
      return Array.isArray(value) && value.every((item) => isIntegerArray(item) && item.length === 4);
    case FieldTypeEnum.PositionList:
      return Array.isArray(value) && value.every(isPosition);
    case FieldTypeEnum.IntPair:
      return isIntegerArray(value) && value.length === 2;
    case FieldTypeEnum.StringPair:
      return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "string");
    case FieldTypeEnum.StringPairList:
      return Array.isArray(value) && value.every((item) =>
        Array.isArray(item) && item.length === 2 && item.every((part) => typeof part === "string"),
      );
    case FieldTypeEnum.ObjectList:
      return Array.isArray(value) && value.every(isRecord);
    case FieldTypeEnum.StringOrObjectList:
      return Array.isArray(value) && value.every((item) => typeof item === "string" || isRecord(item));
    case FieldTypeEnum.Any:
      return true;
  }
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap(collectStrings);
}

function isMissingRequiredValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
