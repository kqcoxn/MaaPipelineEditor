import { create } from "zustand";

export enum ErrorTypeEnum {
  NodeNameRepeat = "节点名重复",
}
export type ErrorType = {
  type: ErrorTypeEnum;
  msg: string;
  mark?: string;
  onClick?: (props?: any) => any;
};

function findErrorsByType(type: ErrorTypeEnum) {
  return useErrorStore.getState().errors.filter((error) => error.type === type);
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
