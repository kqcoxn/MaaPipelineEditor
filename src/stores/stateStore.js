import { defineStore } from "pinia";

export const useStateStore = defineStore("StateStore", {
  state: () => ({
    isShowSettingPanel: false,
    vueFlowInstance: null,
    tips: {
      transferTip: "",
    },
  }),
  getters: {
    tipList: (state) => {
      const list = [];
      [state.transferTip].forEach((tip) => {
        if (tip) {
          list.push(tip);
        }
      });
      return list;
    },
  },
  actions: {},
});
