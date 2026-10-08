import { notification } from "@/utils/ui/antdAppApi";

import type { ParamType } from "./types";
import { FieldTypeEnum, type FieldType } from "../fields";
import { JsonHelper } from "../../utils/data/jsonHelper";

import { normalizeFieldList } from "../fields/listValues";
import { normalizeDurationField } from "./duration";
import { parseIntegerList, parseNumericList } from "./numericList";

/**
 * 单个类型匹配器
 * @param value 待匹配的值
 * @param type 目标类型
 * @returns 匹配成功返回转换后的值，失败返回null
 */
function matchSingleType(value: any, type: FieldTypeEnum): any {
  let temp = null;

  try {
    switch (type) {
      case FieldTypeEnum.IntOrString:
        if (typeof value === "string" || Number.isInteger(value)) return value;
        break;
      case FieldTypeEnum.IntOrStringList:
        if (Array.isArray(value) && value.every((item) => typeof item === "string" || Number.isInteger(item))) {
          return [...value];
        }
        break;
      // 整型
      case FieldTypeEnum.Int:
        temp = Number(value);
        if (Number.isInteger(temp)) {
          return temp;
        }
        break;

      // 浮点数
      case FieldTypeEnum.Double:
        temp = Number(value);
        if (!Number.isNaN(temp)) {
          return temp;
        }
        break;

      // True
      case FieldTypeEnum.True:
        if (String(value) === "true") {
          return true;
        }
        break;

      // 布尔
      case FieldTypeEnum.Bool:
        switch (String(value)) {
          case "true":
            return true;
          case "false":
            return false;
        }
        break;

      // 字符串
      case FieldTypeEnum.String:
      case FieldTypeEnum.ImagePath:
        return String(value);

      // 数值列表：仅解析完整的数值输入，不拆分字符串字段。
      case FieldTypeEnum.IntList:
        return parseIntegerList(value);

      case FieldTypeEnum.IntListList:
        if (Array.isArray(value)) {
          const flat = parseIntegerList(value);
          if (flat) return flat;
          const rows = value.map(parseIntegerList);
          if (rows.every((row) => row !== null && row.length > 0 && row.length === rows[0]?.length)) {
            return rows;
          }
        }
        break;

      case FieldTypeEnum.DoubleList:
        return parseNumericList(value);

      // 字符串数组
      case FieldTypeEnum.StringList:
      case FieldTypeEnum.ImagePathList:
        if (Array.isArray(value)) {
          return value.map((item) => String(item));
        }
        break;

      // XYWH
      case FieldTypeEnum.XYWH:
        temp = parseIntegerList(value);
        if (temp?.length === 4) {
          return temp;
        }
        break;

      // XYWH数组
      case FieldTypeEnum.XYWHList:
        if (Array.isArray(value)) {
          // 每一项为 XYWH
          const list: any[] = [];
          let ok = true;
          for (const item of normalizeFieldList(value, type)) {
            const nums = parseIntegerList(item);
            if (nums?.length === 4)
              list.push(nums);
            else {
              ok = false;
              break;
            }
          }
          if (ok) return list;
        } else {
          // XYWH 字符串
          const nums = parseIntegerList(value);
          if (nums?.length === 4) {
            return [nums];
          }
        }
        break;

      // 位置数组
      case FieldTypeEnum.PositionList: {
        const buildPosition = (pos: any) => {
          // true
          if (pos === true || String(pos) === "true") return true;
          // [x,y,w,h] or [x,y]
          const nums = parseIntegerList(pos);
          if (
            nums && (nums.length === 4 || nums.length === 2)
          )
            return nums;
          // label string
          return String(pos);
        };
        if (Array.isArray(value)) {
          const list: any[] = [];
          for (const item of normalizeFieldList(value, type)) {
            list.push(buildPosition(item));
          }
          return list;
        } else {
          return [buildPosition(value)];
        }
      }

      // 整型键值对
      case FieldTypeEnum.IntPair:
        temp = parseIntegerList(value);
        if (temp?.length === 2) {
          return temp;
        }
        break;

      // 字符串键值对必须保持明确的数组结构，内容原样保留。
      case FieldTypeEnum.StringPair:
        if (Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "string")) {
          return [...value];
        }
        break;

      case FieldTypeEnum.StringPairList:
        if (Array.isArray(value)) {
          // 框架允许单条 [pattern, replacement]。
          if (value.length === 2 && value.every((item) => typeof item === "string")) return [...value];
          if (value.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((item) => typeof item === "string"))) {
            return value.map((pair) => [...pair]);
          }
        }
        break;

      // Any
      case FieldTypeEnum.Any:
        if (JsonHelper.isObj(value)) return value;
        else {
          temp = String(value);
          return JsonHelper.stringObjToJson(temp) ?? temp;
        }

      // ObjectList
      case FieldTypeEnum.ObjectList:
        if (Array.isArray(value)) {
          const objList = [];
          for (const obj of value) {
            if (JsonHelper.isObj(obj)) objList.push(obj);
            else {
              temp = String(obj);
              if (JsonHelper.isStringObj(temp)) {
                objList.push(JsonHelper.stringObjToJson(temp));
              }
            }
          }
          if (objList.length === value.length) {
            return objList;
          }
        }
        break;

      // StringOrObjectList
      case FieldTypeEnum.StringOrObjectList:
        if (Array.isArray(value)) {
          const mixedList = [];
          for (const item of value) {
            // object
            if (JsonHelper.isObj(item)) {
              mixedList.push(item);
            }
            // 字符串
            else {
              const str = String(item);
              // 尝试解析为 JSON 对象
              temp = str;
              if (JsonHelper.isStringObj(temp)) {
                mixedList.push(JsonHelper.stringObjToJson(temp));
              } else {
                // 保留为字符串
                mixedList.push(str);
              }
            }
          }
          if (mixedList.length === value.length) {
            return mixedList;
          }
        }
        break;
    }
  } catch (error) {
    // 静默处理类型转换错误
    console.warn(`Type matching failed for type ${type}:`, error);
  }

  return null;
}

/**
 * 参数类型匹配 - 将参数对象按照预定义类型进行匹配转换
 * @param params 待匹配的参数对象
 * @param types 预定义的字段类型数组
 * @param skipValidation 是否跳过校验（跳过时保留原始值）
 * @returns 匹配后的参数对象
 */
export function matchParamType(
  params: ParamType,
  types: FieldType[],
  skipValidation?: boolean,
): ParamType {
  const paramKeys = Object.keys(params);
  const matchedDatas: any = {};

  paramKeys.forEach((key) => {
    // 检查参数是否预定义
    const type = types.find((t) => t.key === key);
    if (!type || key === "focus") {
      // focus 是框架原样透传的 JSON；不能把标量转成字符串或再次解析字符串内容。
      // 未定义的参数同样直接保留。
      matchedDatas[key] = params[key];
      return;
    }

    // 匹配参数类型
    const typeList = Array.isArray(type.type) ? type.type : [type.type];
    const rawValue = params[key];
    const value = type.unit === "ms" ? normalizeDurationField(rawValue, type) : rawValue;
    let matchedValue = null;

    // 尝试所有可能的类型
    for (const fieldType of typeList) {
      if (type.unit === "ms" && value === null) break;
      if (matchedValue !== null) break;
      matchedValue = matchSingleType(value, fieldType);
    }

    if (matchedValue !== null) {
      matchedDatas[key] = matchedValue;
    } else {
      // 类型匹配失败
      if (skipValidation) {
        // 跳过校验时保留原始值
        matchedDatas[key] = rawValue;
      } else {
        // 显示错误通知
        notification.error({
          title: "类型错误",
          description: `部分参数类型错误，请检查各节点字段是否符合Pipeline协议；可能的参数：${key}`,
          placement: "top",
        });
      }
    }
  });

  return matchedDatas;
}
