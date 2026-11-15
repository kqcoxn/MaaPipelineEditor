import { useId, type CSSProperties, type ReactNode } from "react";
import { theme } from "antd";
import { AppleOutlined, DesktopOutlined, MobileOutlined, RocketOutlined } from "@ant-design/icons";
import type { ControllerTab } from "./connectionForm";
import styles from "./ControllerTypeSelect.module.less";

const controllerLabels: Record<ControllerTab, { label: string; icon: ReactNode }> = {
  adb: { label: "ADB 设备", icon: <MobileOutlined /> },
  ios: { label: "iOS 真机", icon: <AppleOutlined /> },
  win32: { label: "Win32 窗口", icon: <DesktopOutlined /> },
  gamepad: { label: "Gamepad", icon: <RocketOutlined /> },
  macos: { label: "macOS 原生", icon: <AppleOutlined /> },
  playcover: { label: "PlayCover", icon: <AppleOutlined /> },
  linux: { label: "Linux", icon: <DesktopOutlined /> },
};

interface Props {
  value: ControllerTab;
  options: ControllerTab[];
  onChange: (value: ControllerTab) => void;
}

/** 原生单选组保留方向键切换能力，名称不随设备类型数量增加而截断。 */
export function ControllerTypeSelect({ value, options, onChange }: Props) {
  const name = useId();
  const { token } = theme.useToken();
  const colors = {
    "--controller-border": token.colorBorderSecondary,
    "--controller-background": token.colorBgContainer,
    "--controller-text": token.colorText,
    "--controller-selected": token.colorPrimary,
    "--controller-selected-background": token.colorPrimaryBg,
    "--controller-hover": token.colorPrimaryBorderHover,
    "--controller-focus": token.colorPrimaryBorder,
  } as CSSProperties;

  return <div className={styles.group} style={colors} role="radiogroup" aria-label="设备类型">
    {options.map(type => <label key={type} className={styles.option}>
      <input type="radio" name={name} value={type} checked={value === type} onChange={() => onChange(type)} />
      <span className={styles.tile}>
        <span className={styles.icon} aria-hidden="true">{controllerLabels[type].icon}</span>
        <span>{controllerLabels[type].label}</span>
      </span>
    </label>)}
  </div>;
}
