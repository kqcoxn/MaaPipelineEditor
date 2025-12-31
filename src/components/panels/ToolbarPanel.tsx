import style from "../../styles/ToolbarPanel.module.less";
import { memo } from "react";
import ImportButton from "./toolbar-items/ImportButton.tsx";
import ExportButton from "./toolbar-items/ExportButton.tsx";
import JsonPreviewButton from "./toolbar-items/JsonPreviewButton.tsx";

/**
 * 横向工具栏组件
 * 位于界面右上角,集成导入、导出、JSON预览功能
 */
function ToolbarPanel() {
  return (
    <div className={style.toolbarPanel}>
      <ExportButton />
      <ImportButton />
      <JsonPreviewButton />
    </div>
  );
}

export default memo(ToolbarPanel);
