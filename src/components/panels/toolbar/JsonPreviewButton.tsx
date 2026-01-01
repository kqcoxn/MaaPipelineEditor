import { Button } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { memo } from "react";
import { useToolbarStore } from "../../../stores/toolbarStore";
import style from "../../../styles/ToolbarPanel.module.less";

/**
 * JSON预览按钮组件
 * 控制JSON浮动面板的显示/隐藏,支持编译预览
 */
function JsonPreviewButton() {
  const { jsonPanelVisible, toggleJsonPanel } = useToolbarStore();

  // 点击按钮切换面板显示状态
  const handleButtonClick = () => {
    toggleJsonPanel();
  };

  return (
    <Button
      icon={<EyeOutlined />}
      onClick={handleButtonClick}
      className={`${style.toolbarButton} ${
        jsonPanelVisible ? style.active : ""
      }`}
    >
      JSON 预览
    </Button>
  );
}

export default memo(JsonPreviewButton);
