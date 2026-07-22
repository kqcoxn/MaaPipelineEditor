import { createContext, useContext } from "react";

export const FlowReadOnlyContext = createContext(false);

export function useFlowReadOnly(): boolean {
  return useContext(FlowReadOnlyContext);
}
