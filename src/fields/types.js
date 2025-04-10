export class TypeParser {
  constructor(type) {
    if (type) {
      this.init(type);
    }
  }

  init(type) {
    // 列表类型
    if (type.includes("[") && type.includes("]")) {
      this.type = "list";
      this.listType = type.match(/^([a-zA-Z]+)/)[1];
      this.listLength = parseInt(type.split("[")[1].split("]")[0], 10);
      if (!this.listLength) {
        this.isCustomLength = true;
      }
      return this.type;
    }

    // 数字类型
    if (type == "number") {
      this.type = "number";
      return this.type;
    }

    // 布尔类型
    if (type == "boolean") {
      this.type = "boolean";
      return this.type;
    }

    // 枚举类型
    if (type == "enum") {
      this.type = "enum";
      return this.type;
    }

    this.type = "string";
    return this.type;
  }
}
