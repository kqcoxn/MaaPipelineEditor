import { create } from "zustand";

/**
 * 工具栏状态管理
 */

// 导入操作类型
export type ImportAction =
  | "clipboard-pipeline"
  | "file-pipeline"
  | "clipboard-config"
  | "file-config";

// 导出操作类型
export type ExportAction =
  | "clipboard"
  | "file"
  | "save-local"
  | "save-local-all"
  | "save-local-pipeline"
  | "save-local-config"
  | "create-local"
  | "partial"
  | "export-pipeline"
  | "export-config";

interface ToolbarState {
  // 默认导入操作
  defaultImportAction: ImportAction;
  // 默认导出操作
  defaultExportAction: ExportAction;

  // Actions
  setDefaultImportAction: (action: ImportAction) => void;
  setDefaultExportAction: (action: ExportAction) => void;
}

// 从 localStorage 读取默认操作
const getDefaultImportAction = (): ImportAction => {
  const stored = localStorage.getItem("mpe_default_import_action");
  if (stored && isValidImportAction(stored)) {
    return stored as ImportAction;
  }
  return "clipboard-pipeline";
};

const getDefaultExportAction = (): ExportAction => {
  const stored = localStorage.getItem("mpe_default_export_action");
  if (stored && isValidExportAction(stored)) {
    return stored as ExportAction;
  }
  return "clipboard";
};

// 验证导入操作类型
function isValidImportAction(action: string): boolean {
  return [
    "clipboard-pipeline",
    "file-pipeline",
    "clipboard-config",
    "file-config",
  ].includes(action);
}

// 验证导出操作类型
function isValidExportAction(action: string): boolean {
  return [
    "clipboard",
    "file",
    "save-local",
    "save-local-all",
    "save-local-pipeline",
    "save-local-config",
    "create-local",
    "partial",
    "export-pipeline",
    "export-config",
  ].includes(action);
}

export const useToolbarStore = create<ToolbarState>((set) => ({
  defaultImportAction: getDefaultImportAction(),
  defaultExportAction: getDefaultExportAction(),

  setDefaultImportAction: (action: ImportAction) => {
    localStorage.setItem("mpe_default_import_action", action);
    set({ defaultImportAction: action });
  },

  setDefaultExportAction: (action: ExportAction) => {
    localStorage.setItem("mpe_default_export_action", action);
    set({ defaultExportAction: action });
  },
}));
