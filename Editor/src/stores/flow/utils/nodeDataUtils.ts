import { NodeTypeEnum } from "../../../components/flow/nodes";
import { actionParamKeys, recoParamKeys } from "../../../core/fields";
import type { NodeType } from "../types";

export interface NodeDataUpdate {
  type: string;
  key: string;
  value: any;
}

export function applyNodeDataUpdates(
  node: NodeType,
  updates: NodeDataUpdate[],
): NodeType {
  const originalNode = node as any;
  const targetNode = {
    ...originalNode,
    data: { ...originalNode.data },
  };

  if (node.type === NodeTypeEnum.Pipeline) {
    targetNode.data.recognition = originalNode.data.recognition
      ? {
          ...originalNode.data.recognition,
          param: { ...originalNode.data.recognition.param },
        }
      : { type: "DirectHit", param: {} };
    targetNode.data.action = originalNode.data.action
      ? {
          ...originalNode.data.action,
          param: { ...originalNode.data.action.param },
        }
      : { type: "DoNothing", param: {} };
    targetNode.data.others = originalNode.data.others
      ? { ...originalNode.data.others }
      : {};
  }

  for (const update of updates) {
    const { type, key } = update;
    const value = Array.isArray(update.value)
      ? [...update.value]
      : update.value;

    if (type === "recognition" || type === "action") {
      if (value === "__mpe_delete") {
        delete targetNode.data[type].param[key];
      } else {
        targetNode.data[type].param[key] = value;
      }
      continue;
    }

    if (type === "type") {
      const field = targetNode.data[key];
      field.type = value;
      const fieldParamKeys =
        key === "recognition" ? recoParamKeys[value] : actionParamKeys[value];
      for (const paramKey of Object.keys(field.param)) {
        if (!fieldParamKeys.all.includes(paramKey)) {
          delete field.param[paramKey];
        }
      }
      fieldParamKeys.requires.forEach((requiredKey, index) => {
        if (!(requiredKey in field.param)) {
          field.param[requiredKey] = fieldParamKeys.required_default[index];
        }
      });
      continue;
    }

    if (type === "others") {
      targetNode.data.others ??= {};
      if (value === "__mpe_delete") {
        delete targetNode.data.others[key];
      } else {
        targetNode.data.others[key] = value;
      }
      continue;
    }

    targetNode.data[key] = value;
  }

  return targetNode as NodeType;
}
