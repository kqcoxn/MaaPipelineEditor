import { defineStore } from "pinia";

export const useStateStore = defineStore("StateStore", {
  state: () => ({
    transferTip: "",
  }),
  getters: {
    tips: (state) => {
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
