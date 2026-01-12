import { notification } from "antd";
import { flatten } from "lodash";
import type { ParamType } from "./types";
import { FieldTypeEnum, type FieldType } from "../fields";
import { JsonHelper } from "../../utils/jsonHelper";

/**
 * 纯化字符串列表
 * @param list 待处理的列表
 * @returns 字符串数组
 */
function pureStringList(list: any): string[] {
  return String(list)
    .replace(/[\s\[\]]/g, "")
    .split(/[,，]/);
}

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

      // 整型数组
      case FieldTypeEnum.IntList:
        if (Array.isArray(value)) {
          temp = value.map((item) => Number(item));
          if (temp.every((n) => Number.isInteger(n))) {
            return temp;
          }
        }
        break;

      // 二维整型数组
      case FieldTypeEnum.IntListList:
        if (Array.isArray(value)) {
          const number2DList: any[] = [];
          let length = 0;
          for (let list of value) {
            temp = pureStringList(list).map((c) => Number(c));
            if (length === 0) length = temp.length;
            if (
              temp.length !== length ||
              temp.some((n) => !Number.isInteger(n))
            ) {
              length = 0;
              break;
            }
            number2DList.push(temp);
          }
          if (length > 0) {
            return length === 1 ? flatten(number2DList) : number2DList;
          }
        }
        break;

      // 浮点数数组
      case FieldTypeEnum.DoubleList:
        if (Array.isArray(value)) {
          temp = value.map((item) => Number(item));
          if (temp.every((n) => !Number.isNaN(n))) {
            return temp;
          }
        }
        break;

      // 字符串数组
      case FieldTypeEnum.StringList:
      case FieldTypeEnum.ImagePathList:
        if (Array.isArray(value)) {
          return value.map((item) => String(item));
        }
        break;

      // XYWH
      case FieldTypeEnum.XYWH:
        temp = pureStringList(value).map((c) => Number(c));
        if (temp.length === 4 && temp.every((n) => Number.isInteger(n))) {
          return temp;
        }
        break;

      // XYWH数组
      case FieldTypeEnum.XYWHList:
        if (Array.isArray(value)) {
          // [x,y,w,h] -> [[x,y,w,h]]
          const allInt = value.every((n) => Number.isInteger(Number(n)));
          if (value.length === 4 && allInt) {
            return [value.map((n) => Number(n))];
          }
          // 每一项为 XYWH
          const list: any[] = [];
          let ok = true;
          for (const item of value) {
            const nums = pureStringList(item).map((c) => Number(c));
            if (nums.length === 4 && nums.every((n) => Number.isInteger(n)))
              list.push(nums);
            else {
              ok = false;
              break;
            }
          }
          if (ok) return list;
        } else {
          // XYWH 字符串
          const nums = pureStringList(value).map((c) => Number(c));
          if (nums.length === 4 && nums.every((n) => Number.isInteger(n))) {
            return [nums];
          }
        }
        break;

      // 位置数组
      case FieldTypeEnum.PositionList:
        const buildPosition = (pos: any) => {
          // true
          if (pos === true || String(pos) === "true") return true;
          // [x,y,w,h] or [x,y]
          let nums = pureStringList(pos).map((c) => Number(c));
          if (
            (nums.length === 4 || nums.length === 2) &&
            nums.every((n) => Number.isInteger(n))
          )
            return nums;
          // label string
          return String(pos);
        };
        if (Array.isArray(value)) {
          const allInt = value.every((n) => Number.isInteger(Number(n)));
          if (value.length === 4 && allInt) {
            return [value.map((n) => Number(n))];
          }
          const list: any[] = [];
          for (const item of value) {
            list.push(buildPosition(item));
          }
          return list;
        } else {
          return [buildPosition(value)];
        }

      // 整型键值对
      case FieldTypeEnum.IntPair:
        temp = pureStringList(value).map((c) => Number(c));
        if (temp.length === 2 && temp.every((n) => Number.isInteger(n))) {
          return temp;
        }
        break;

      // 键值对
      case FieldTypeEnum.StringPair:
        temp = String(value)
          .replaceAll(/[" \[\]]/g, "")
          .split(",");
        if (temp.length === 2) {
          return temp;
        }
        break;

      // 键值对数组
      case FieldTypeEnum.StringPairList:
        if (Array.isArray(value)) {
          const stringPairList: any[] = [];
          for (let pair of value) {
            if (Array.isArray(pair) && pair.length === 2) {
              stringPairList.push(pair.map((s) => String(s)));
              continue;
            }
            temp = String(pair)
              .replaceAll(/[" \[\]]/g, "")
              .split(",");
            if (temp.length === 2) {
              stringPairList.push(temp);
            }
          }
          return stringPairList;
        }
        break;

      // Any
      case FieldTypeEnum.Any:
        if (JsonHelper.isObj(value)) return value;
        else {
          temp = String(value).replaceAll(/[""]/g, `"`);
          return JsonHelper.stringObjToJson(temp) ?? temp;
        }

      // ObjectList
      case FieldTypeEnum.ObjectList:
        if (Array.isArray(value)) {
          const objList = [];
          for (let obj of value) {
            if (JsonHelper.isObj(obj)) objList.push(obj);
            else {
              temp = String(obj).replaceAll(/[""]/g, `"`);
              JsonHelper.isStringObj(temp) &&
                objList.push(JsonHelper.stringObjToJson(temp));
            }
          }
          if (objList.length === value.length) {
            return objList;
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
 * @returns 匹配后的参数对象
 */
export function matchParamType(
  params: ParamType,
  types: FieldType[]
): ParamType {
  const paramKeys = Object.keys(params);
  const matchedDatas: any = {};

  paramKeys.forEach((key) => {
    // 检查参数是否预定义
    const type = types.find((t) => t.key === key);
    if (!type) {
      // 未定义的参数直接保留
      matchedDatas[key] = params[key];
      return;
    }

    // 匹配参数类型
    const typeList = Array.isArray(type.type) ? type.type : [type.type];
    const value = params[key];
    let matchedValue = null;

    // 尝试所有可能的类型
    for (const fieldType of typeList) {
      if (matchedValue !== null) break;
      matchedValue = matchSingleType(value, fieldType);
    }

    if (matchedValue !== null) {
      matchedDatas[key] = matchedValue;
    } else {
      // 类型匹配失败，显示错误通知
      notification.error({
        message: "类型错误",
        description: `部分参数类型错误，请检查各节点字段是否符合Pipeline协议；可能的参数：${key}`,
        placement: "top",
      });
    }
  });

  return matchedDatas;
}
