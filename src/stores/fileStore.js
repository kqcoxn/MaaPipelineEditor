import { defineStore } from "pinia";

import { TopNotice } from "../utils/notice";
import { Storage } from "../utils/storage";
import Transfer from "../core/transfer";
import Page from "../utils/page";

let fileCounter = 0;

export const useFileStore = defineStore("FileStore", {
  state: () => ({
    files: [],
    currentName: null,
  }),
  getters: {
    count: (state) => {
      return state.files.length;
    },
    currentIndex: (state) => {
      return state.files.findIndex((file) => file.name == state.currentName);
    },
    currentFile: (state) => {
      return state.files.find((file) => file.name == state.currentName);
    },
    currentJson: (state) => {
      return state.currentFile?.json;
    },
    currentConfig: (state) => {
      return state.currentFile?.config;
    },
  },
  actions: {
    // 查找文件
    findIndex(filename) {
      return this.files.findIndex((file) => file.name == filename);
    },
    find(filename) {
      return this.files.find((file) => file.name == filename);
    },

    clear() {
      this.files = [];
      this.currentName = null;
    },

    // 新建文件
    addFile(
      filename,
      { isTip, autoFit } = {
        isTip: false,
        autoFit: false,
      }
    ) {
      if (!filename) {
        filename = `新建文件${++fileCounter}`;
      }
      // 检查是否已经有同名文件
      if (this.find(filename)) {
        this.addFile(null, { isTip, autoFit });
        return;
      }
      this.files.push({ name: filename, json: {}, config: {} });
      this.switchFile(filename);
      if (autoFit) {
        setTimeout(() => {
          Page.focus({ padding: 0.4 });
        }, 200);
      }
      if (isTip) {
        TopNotice.success("已创建：" + filename);
      }
    },

    // 切换文件
    switchFile(file) {
      this.currentName = typeof file == "number" ? this.files[file].name : file;
      Transfer.jsonToNodes(this.currentJson || {}, false);
    },
    changeName(filename) {
      if (!filename) return;
      this.currentFile.name = this.currentName = filename;
    },

    // 移除文件
    removeFile(filename, isTip = true) {
      // 检查是否只有一个文件
      if (this.count == 1) {
        TopNotice.error("最后一个文件不能被删除");
        return;
      }

      // 移除文件
      const isCurrent = filename == this.currentName;
      const fileIndex = this.findIndex(filename);
      this.files.splice(fileIndex, 1);
      if (isCurrent) {
        this.switchFile(fileIndex - 1);
        setTimeout(() => {
          Page.focus({ padding: 0.4 });
        }, 200);
      }
      Storage.remove(filename);
      if (isTip) {
        TopNotice.success("文件删除成功");
      }
    },
  },
});
