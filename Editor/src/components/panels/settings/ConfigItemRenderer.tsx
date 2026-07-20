import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  Switch,
  Select,
  InputNumber,
  Input,
  Slider,
  Tooltip,
  Button,
  Space,
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
    const { t } = useTranslation();
    const value = useConfigStore((state) => {
      if (item.key.startsWith("__")) return undefined;
      return state.configs[item.key as keyof typeof state.configs];
    });
    const configs = useConfigStore((state) => state.configs);
    const setConfig = useConfigStore((state) => state.setConfig);
    const resetConfig = useConfigStore((state) => state.resetConfig);

    const itemKey = String(item.key);
    const settingsKey = (field: string) => `settings.items.${itemKey}.${field}`;
    const translateField = (field: string, value?: string) =>
      value ? t(settingsKey(field), value) : value;

    const resolvedPlaceholder = useMemo(() => {
      const raw = item.dynamicPlaceholder?.(configs) ?? item.placeholder;
      return raw ? translateField("placeholder", raw) : raw;
    }, [item, configs, t]);
    const resolvedTipContent = useMemo(() => {
      const raw = item.dynamicTipContent?.(configs) ?? item.tipContent;
      return raw ? translateField("tipContent", raw) : raw;
    }, [item, configs, t]);

    const resolvedLabel = translateField("label", item.label) ?? item.label;
    const resolvedTipTitle = translateField("tipTitle", item.tipTitle) ?? item.tipTitle;
    const resolvedCheckedChildren = translateField(
      "checkedChildren",
      item.checkedChildren,
    );
    const resolvedUnCheckedChildren = translateField(
      "unCheckedChildren",
      item.unCheckedChildren,
    );
    const resolvedAddonAfter = translateField("addonAfter", item.addonAfter);

    const resolvedSelectOptions = useMemo(() => {
      if (!item.options) return item.options;
      return item.options.map((option, index) => ({
        ...option,
        label: t(
          `${settingsKey("options")}.${String(option.value ?? index)}`,
          String(option.label),
        ),
      }));
    }, [item.options, itemKey, t]);

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
              checkedChildren={resolvedCheckedChildren}
              unCheckedChildren={resolvedUnCheckedChildren}
              onChange={(checked) =>
                setConfig(
                  item.key as keyof typeof configDefaults,
                  checked,
                )
              }
            />
          );

        case "select":
          return (
            <Select
              value={value}
              style={{ width: item.controlWidth || 120 }}
              options={resolvedSelectOptions ?? item.options}
              onChange={(val) =>
                setConfig(item.key as keyof typeof configDefaults, val)
              }
            />
          );

        case "inputNumber": {
          const inputNumber = (
            <InputNumber
              value={value as number}
              style={{ width: item.controlWidth || 100 }}
              min={item.min}
              max={item.max}
              step={item.step}
              onChange={(val) => {
                if (val !== null && val !== undefined) {
                  setConfig(item.key as keyof typeof configDefaults, val);
                }
              }}
            />
          );
          if (resolvedAddonAfter) {
            return (
              <Space.Compact>
                {inputNumber}
                <Button disabled>{resolvedAddonAfter}</Button>
              </Space.Compact>
            );
          }
          return inputNumber;
        }

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

        case "textarea":
          return (
            <Input.TextArea
              value={value as string}
              placeholder={resolvedPlaceholder}
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ maxWidth: item.controlWidth || 360 }}
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
          padding: item.hideLabel ? 0 : "8px 12px",
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
        {!item.hideLabel && (
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
              title={resolvedTipTitle}
              content={
                resolvedTipContent ? (
                  <div style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                    {resolvedTipContent}
                  </div>
                ) : undefined
              }
            >
              <span style={{ cursor: "help", fontSize: 14 }}>{resolvedLabel}</span>
            </Popover>
          </div>
        )}

        {/* 控件区域 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: item.hideLabel ? "flex-start" : "flex-end",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isModified && (
            <Tooltip title={t("settings.resetDefault", "恢复默认")}>
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
