import { create } from "zustand";
import i18n from "../i18n";

export enum ErrorTypeEnum {
  NodeNameRepeat = "nodeNameRepeat",
}
export type ErrorType = {
  type: ErrorTypeEnum;
  msg: string;
  mark?: string;
  onClick?: (props?: any) => any;
};

export function findErrorsByType(type: ErrorTypeEnum) {
  return useErrorStore.getState().errors.filter((error) => error.type === type);
}

export function getErrorTypeLabel(type: ErrorTypeEnum): string {
  switch (type) {
    case ErrorTypeEnum.NodeNameRepeat:
      return i18n.t("stores.error.nodeNameRepeat", "节点名重复");
    default:
      return String(type);
  }
}

type ErrorState = {
  errors: ErrorType[];
  setError: (
    type: ErrorTypeEnum,
    cb: (errors?: ErrorType[]) => ErrorType[]
  ) => void;
};
export const useErrorStore = create<ErrorState>()((set) => ({
  errors: [],
  setError(type, cb) {
    set((state) => {
      // 过滤对应错误
      const originErrors = findErrorsByType(type);
      const newErrors = cb(originErrors);
      const errors = [
        ...state.errors.filter((error) => !originErrors.includes(error)),
        ...newErrors,
      ];
      return { errors };
    });
  },
}));
