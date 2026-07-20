import { Button } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import style from "../../../styles/panels/ToolbarPanel.module.less";

/**
 * JSON预览按钮组件
 * 控制JSON浮动面板的显示/隐藏,支持编译预览
 */
function JsonPreviewButton() {
  const { t } = useTranslation();
  const { isActive, activate, deactivate } = usePanelOccupancy("json");

  const handleButtonClick = () => {
    if (isActive) {
      deactivate();
    } else {
      activate();
    }
  };

  return (
    <Button
      icon={<EyeOutlined />}
      onClick={handleButtonClick}
      className={`${style.toolbarButton} ${isActive ? style.active : ""}`}
    >
      {t("ui.panels.toolbar.jsonPreview", "JSON 预览")}
    </Button>
  );
}

export default memo(JsonPreviewButton);
