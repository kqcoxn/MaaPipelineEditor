import { memo, useMemo } from "react";
import {
  Popover,
  Switch,
  Select,
  InputNumber,
  Input,
  Slider,
  Tooltip,
} from "antd";
import { UndoOutlined } from "@ant-design/icons";
import { useConfigStore } from "../../../stores/configStore";
import { configDefaults } from "../../../stores/configStore";
import type { ConfigItemDef } from "./settingsDefinitions";
import { customRenderers } from "./customRenderers";

interface ConfigItemRendererProps {
  item: ConfigItemDef;
  isConditional?: boolean;
}

/**通用配置项渲染器 */
const ConfigItemRenderer = memo(
  ({ item, isConditional }: ConfigItemRendererProps) => {
    const value = useConfigStore((state) => {
      // 自定义项可能用虚拟 key，从 configs 中取不到值
      if (item.key.startsWith("__")) return undefined;
      return state.configs[item.key as keyof typeof state.configs];
    });
    const configs = useConfigStore((state) => state.configs);
    const setConfig = useConfigStore((state) => state.setConfig);
    const resetConfig = useConfigStore((state) => state.resetConfig);

    // 计算动态属性
    const resolvedPlaceholder = useMemo(
      () => item.dynamicPlaceholder?.(configs) ?? item.placeholder,
      [item, configs],
    );
    const resolvedTipContent = useMemo(
      () => item.dynamicTipContent?.(configs) ?? item.tipContent,
      [item, configs],
    );

    // 判断是否已修改（值 ≠ 默认值）
    const isModified = useMemo(() => {
      if (item.key.startsWith("__")) return false;
      const defaultValue =
        configDefaults[item.key as keyof typeof configDefaults];
      return JSON.stringify(value) !== JSON.stringify(defaultValue);
    }, [item.key, value]);

    // 恢复默认
    const handleReset = () => {
      resetConfig(item.key as keyof typeof configDefaults);
    };

    // 渲染控件
    const renderControl = () => {
      // 自定义渲染
      if (item.type === "custom" && item.customRender) {
        const CustomComponent = customRenderers[item.customRender];
        if (CustomComponent) return <CustomComponent />;
        return null;
      }

      switch (item.type) {
        case "switch":
          return (
            <Switch
              checked={value as boolean}
              checkedChildren={item.checkedChildren}
              unCheckedChildren={item.unCheckedChildren}
              onChange={(checked) =>
                setConfig(
                  item.key as keyof typeof configDefaults,
                  checked as any,
                )
              }
            />
          );

        case "select":
          return (
            <Select
              value={value}
              style={{ width: item.controlWidth || 120 }}
              options={item.options}
              onChange={(val) =>
                setConfig(item.key as keyof typeof configDefaults, val)
              }
            />
          );

        case "inputNumber":
          return (
            <InputNumber
              value={value as number}
              style={{ width: item.controlWidth || 100 }}
              min={item.min}
              max={item.max}
              step={item.step}
              addonAfter={item.addonAfter}
              onChange={(val) => {
                if (val !== null && val !== undefined) {
                  setConfig(item.key as keyof typeof configDefaults, val);
                }
              }}
            />
          );

        case "input":
          return (
            <Input
              value={value as string}
              placeholder={resolvedPlaceholder}
              onChange={(e) =>
                setConfig(
                  item.key as keyof typeof configDefaults,
                  e.target.value,
                )
              }
            />
          );

        case "inputPassword":
          return (
            <Input.Password
              value={value as string}
              placeholder={resolvedPlaceholder}
              onChange={(e) =>
                setConfig(
                  item.key as keyof typeof configDefaults,
                  e.target.value,
                )
              }
            />
          );

        case "slider":
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
            >
              <Slider
                min={item.min}
                max={item.max}
                step={item.step}
                value={value as number}
                onChange={(v) =>
                  setConfig(item.key as keyof typeof configDefaults, v)
                }
                style={{ flex: 1, marginBottom: 0 }}
              />
              <span style={{ minWidth: 32, textAlign: "right" }}>
                {(value as number).toFixed(item.step && item.step < 1 ? 1 : 0)}
              </span>
            </div>
          );

        case "button":
          if (item.customRender) {
            const CustomComponent = customRenderers[item.customRender];
            if (CustomComponent) return <CustomComponent />;
          }
          return null;

        default:
          return null;
      }
    };

    return (
      <div
        className={`config-card ${isConditional ? "config-card-conditional" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--ant-color-border-secondary)",
          marginBottom: 6,
          position: "relative",
          background: isConditional
            ? "var(--ant-color-fill-quaternary)"
            : "transparent",
          marginLeft: isConditional ? 20 : 0,
          transition: "background 0.2s",
        }}
      >
        {/* 标签区域 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            marginRight: 16,
            position: "relative",
          }}
        >
          {/* 修改标记小圆点 */}
          {isModified && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--ant-color-primary)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
          )}
          <Popover
            placement="bottomLeft"
            title={item.tipTitle}
            content={
              resolvedTipContent ? (
                <div style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                  {resolvedTipContent}
                </div>
              ) : undefined
            }
          >
            <span style={{ cursor: "help", fontSize: 14 }}>{item.label}</span>
          </Popover>
        </div>

        {/* 控件区域 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isModified && (
            <Tooltip title="恢复默认">
              <UndoOutlined
                onClick={handleReset}
                style={{
                  fontSize: 13,
                  color: "var(--ant-color-text-tertiary)",
                  cursor: "pointer",
                }}
              />
            </Tooltip>
          )}
          {renderControl()}
        </div>
      </div>
    );
  },
);

export default ConfigItemRenderer;
