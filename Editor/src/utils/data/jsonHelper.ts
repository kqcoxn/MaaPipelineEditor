export class JsonHelper {
  static isObj(obj: any) {
    return obj != null && typeof obj === "object";
  }

  static isStringObj(str: string) {
    try {
      return JsonHelper.isObj(JSON.parse(str));
    } catch {
      return false;
    }
  }

  static objToString(obj: any) {
    if (!JsonHelper.isObj(obj)) return null;
    try {
      return JSON.stringify(obj);
    } catch {
      return null;
    }
  }

  static stringObjToJson(obj: any) {
    if (!JsonHelper.isStringObj(obj)) return null;
    return JSON.parse(obj);
  }
}
