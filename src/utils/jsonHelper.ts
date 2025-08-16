export class JsonHelper {
  static isObj(obj: any) {
    return obj !== null && typeof obj === "object";
  }

  static isStringObj(str: string) {
    try {
      JSON.parse(str);
      return true;
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
}
