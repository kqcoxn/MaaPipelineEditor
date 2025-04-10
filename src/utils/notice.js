import { ElMessage } from "element-plus";

export class TopNotice {
  static success(msg) {
    ElMessage.success(msg + "😊");
  }

  static error(msg) {
    ElMessage.error(msg + "😢");
  }
}
