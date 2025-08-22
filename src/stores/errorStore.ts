import { create } from "zustand";

enum ErrorTypeEnum {
  NodeNameRepeat = "节点名重复",
}
type ErrorType = {
  type: ErrorTypeEnum;
  msg: string;
  mark?: string;
  onClick?: (props: any) => any;
};

function findErrorsByType(type: ErrorTypeEnum) {
  return useErrorStore.getState().errors.filter((error) => error.type === type);
}

type ErrorState = {
  errors: ErrorType[];
  setError: (
    type: ErrorTypeEnum,
    cb: (errors: ErrorType[]) => ErrorType[]
  ) => void;
};
export const useErrorStore = create<ErrorState>()((set) => ({
  errors: [
    {
      type: ErrorTypeEnum.NodeNameRepeat,
      msg: "重复节点：新建节点1",
    },
    {
      type: ErrorTypeEnum.NodeNameRepeat,
      msg: "重复节点：新建节点2",
    },
    {
      type: ErrorTypeEnum.NodeNameRepeat,
      msg: "重复节点：新建节点3",
    },
  ],
  setError(type, cb) {
    set((state) => {
      // 过滤对应错误
      const errors = findErrorsByType(type);
      const newErrors = cb(errors);
      return { errors: { ...state.errors, ...newErrors } };
    });
  },
}));
