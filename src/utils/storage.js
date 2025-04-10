import { TopNotice } from "./notice";
import Page from "./page";

export class Storage {
  static existStorage() {
    return exist;
  }
  static save(filename, jsonObj) {
    const files = JSON.parse(localStorage.getItem("files"));
    files[filename] = jsonObj;
    localStorage.setItem("files", JSON.stringify(files));
  }

  static remove(filename) {
    const files = JSON.parse(localStorage.getItem("files"));
    delete files[filename];
    localStorage.setItem("files", JSON.stringify(files));
  }

  static load(
    each = (filename, jsonObj) => {
      console.log(filename, jsonObj);
    },
    loaded = () => {}
  ) {
    // 检测是否存在
    const filesStr = localStorage.getItem("files");
    if (!filesStr) {
      localStorage.setItem("files", "{}");
      return;
    }
    const files = {};
    try {
      Object.assign(files, JSON.parse(filesStr));
    } catch {
      localStorage.setItem("files", "{}");
      return;
    }

    // 读取
    const filenames = Object.keys(files);
    if (filenames.length == 0) return;
    filenames.forEach((filename, index) => {
      setTimeout(() => {
        each(filename, files[filename]);
        if (index == filenames.length - 1) {
          loaded();
        }
      }, index * 600);
    });
    return true;
  }
}

export class Payaboard {
  // 写入粘贴板
  static copy(target) {
    // 格式转换
    if (target instanceof Element) {
      target = target.innerText;
    } else if (target instanceof Array) {
      target = target.join("\n");
    } else if (typeof target == "object") {
      target = JSON.stringify(target);
    }
    // 写入
    const input = document.createElement("input");
    input.value = target;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    // 提示
    TopNotice.success("已复制到粘贴板");
    return target;
  }

  // 从粘贴板读取
  static async paste() {
    let promise = new Promise((resolve, reject) => {
      navigator.clipboard
        .readText()
        .then((text) => {
          resolve(text);
        })
        .catch((err) => {
          reject(err);
        });
    });
    return await promise.then(
      (value) => {
        TopNotice.success("已读取粘贴板");
        return value;
      },
      (reason) => {
        TopNotice.error("读取粘贴板失败");
        return "";
      }
    );
  }
}
