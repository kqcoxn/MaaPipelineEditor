import style from "../../../styles/panels/ToolbarPanel.module.less";
import { memo } from "react";
import ImportButton from "../toolbar/ImportButton.tsx";
import ExportButton from "../toolbar/ExportButton.tsx";
import JsonPreviewButton from "../toolbar/JsonPreviewButton.tsx";
import OpenLocalButton from "../toolbar/OpenLocalButton.tsx";
import { WikiAnchor } from "../../wiki/WikiAnchor";
import EmbedSyncButton from "../toolbar/EmbedSyncButton";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
import { shouldShowLocalToolbarActions } from "./toolbarVisibility";
import { useConfigStore } from "@/stores/app/configStore";

/**
 * 横向工具栏组件
 * 位于界面右上角,集成导入、导出、JSON预览功能
 */
function ToolbarPanel() {
  const { isEmbed } = useEmbedMode();
  const showLocalActions = shouldShowLocalToolbarActions(isEmbed);
  const showJsonPreviewButton = useConfigStore(
    (state) => state.configs.showJsonPreviewButton,
  );
  const showOpenLocalButton = useConfigStore(
    (state) => state.configs.showOpenLocalButton,
  );
  return (
    <div className={style.toolbarPanel}>
      <ExportButton />
      {showLocalActions && <ImportButton />}
      <EmbedSyncButton />
      {showLocalActions && showJsonPreviewButton && <JsonPreviewButton />}
      {showLocalActions && showOpenLocalButton && <OpenLocalButton />}
      <WikiAnchor path="10.工作流面板/90.导入与导出.html" title="导入与导出" description="Pipeline文件的导入导出" />
    </div>
  );
}

export default memo(ToolbarPanel);
