import style from "../../../styles/panels/ToolbarPanel.module.less";
import { memo } from "react";
import ImportButton from "../toolbar/ImportButton.tsx";
import ExportButton from "../toolbar/ExportButton.tsx";
import JsonPreviewButton from "../toolbar/JsonPreviewButton.tsx";
import { WikiAnchor } from "../../wiki/WikiAnchor";

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
      <WikiAnchor path="10.工作流面板/90.导入与导出.html" title="导入与导出" description="Pipeline文件的导入导出" />
    </div>
  );
}

export default memo(ToolbarPanel);
