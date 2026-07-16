import { Button } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { memo } from "react";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import style from "../../../styles/panels/ToolbarPanel.module.less";

/**
 * JSON预览按钮组件
 * 控制JSON浮动面板的显示/隐藏,支持编译预览
 */
function JsonPreviewButton() {
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
      JSON 预览
    </Button>
  );
}

export default memo(JsonPreviewButton);
