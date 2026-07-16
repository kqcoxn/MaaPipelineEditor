/**
 * 探索模式悬浮球组件
 * 始终显示，但未连接时点击提示
 * 位置：LayoutPanel 上方
 */

import { memo } from "react";
import { Tooltip, Badge, message } from "antd";
import classNames from "classnames";
import IconFont from "../../iconfonts";
import { useMFWStore } from "../../../stores/mfwStore";
import { useConfigStore } from "../../../stores/configStore";
import { useFlowStore } from "../../../stores/flow";
import { usePanelOccupancy } from "../../../hooks/usePanelOccupancy";
import style from "../../../styles/panels/ExplorationPanel.module.less";

interface ExplorationFABProps {
  onClick: () => void;
  visible?: boolean;
  active?: boolean;
}

function ExplorationFABBase({
  onClick,
  visible = true,
  active = false,
}: ExplorationFABProps) {
  const connectionStatus = useMFWStore((s) => s.connectionStatus);
  const aiApiUrl = useConfigStore((s) => s.configs.aiApiUrl);
  const aiApiKey = useConfigStore((s) => s.configs.aiApiKey);
  const aiModel = useConfigStore((s) => s.configs.aiModel);
  const status = useFlowStore((s) => s.status);
  const stepCount = useFlowStore((s) => s.stepCount);

  // 检查前置条件
  const isConnected = connectionStatus === "connected";
  const isAIConfigured = aiApiUrl && aiApiKey && aiModel;

  // 是否在探索中
  const isExploring = status !== "idle" && status !== "completed";

  // 是否有脉冲动画
  const hasPulse = status === "predicting" || status === "executing";

  // 互斥系统：被其他面板排挤时隐藏
  const { isDisplaced } = usePanelOccupancy("explorationFAB");

  const isHidden = !visible || isDisplaced;

  // 处理点击 - 检查前置条件
  const handleClick = () => {
    if (isHidden) return;
    if (!isConnected) {
      message.warning("请先连接设备");
      return;
    }
    if (!isAIConfigured) {
      message.warning("请先配置 AI API");
      return;
    }
    onClick();
  };

  // 获取提示文本
  const getTooltipTitle = () => {
    if (!isConnected) return "流程探索 (需连接设备)";
    if (!isAIConfigured) return "流程探索 (需配置 AI)";
    if (isExploring) return `探索中 (${stepCount} 步)`;
    return "流程探索";
  };

  return (
    <Tooltip title={getTooltipTitle()} placement="left">
      <div
        className={classNames(style.fab, {
          [style.fabPulse]: hasPulse,
          [style.fabActive]: active || isExploring,
          [style.fabDisabled]: !isConnected || !isAIConfigured,
          [style.fabHidden]: isHidden,
        })}
        onClick={handleClick}
      >
        <IconFont name="icon-jiqiren" size={24} color="#fff" />
        {isExploring && stepCount > 0 && (
          <Badge
            count={stepCount}
            size="small"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              backgroundColor: "#722ed1",
            }}
          />
        )}
      </div>
    </Tooltip>
  );
}

export const ExplorationFAB = memo(ExplorationFABBase);
