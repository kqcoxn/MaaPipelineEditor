import { memo, useCallback, useState } from "react";
import { Modal } from "antd";
import { useConfigStore } from "../../stores/configStore";
import { checkGuard } from "../panels/settings/guardSystem";
import type { ConfigItemDef } from "../panels/settings/settingsDefinitions";

interface GuardPromptModalProps {
  action: string;
  unconfiguredItems: ConfigItemDef[];
  onContinue: () => void;
  onCancel: () => void;
}

/**获取配置项的当前值显示文本 */
function getCurrentValueLabel(item: ConfigItemDef): string | null {
  const configs = useConfigStore.getState().configs;
  const key = item.key as keyof typeof configs;
  const value = configs[key];

  if (value === undefined || value === null) return null;

  // select 类型：从 options 中查找对应的 label
  if (item.type === "select" && item.options) {
    const matched = item.options.find((opt) => opt.value === value);
    return matched?.label ?? String(value);
  }

  // switch 类型
  if (item.type === "switch") {
    return value ? "开启" : "关闭";
  }

  // 其他类型直接展示值
  return String(value);
}

/**预配置引导弹窗 */
const GuardPromptModal = memo(
  ({
    action,
    unconfiguredItems,
    onContinue,
    onCancel,
  }: GuardPromptModalProps) => {
    const setStatus = useConfigStore((state) => state.setStatus);

    const markAsConfigured = useConfigStore((state) => state.markAsConfigured);

    const handleContinue = useCallback(() => {
      // 用户选择继续，将这些项标记为已配置，避免下次重复提示
      unconfiguredItems.forEach((item) => markAsConfigured(item.key));
      onContinue();
    }, [unconfiguredItems, markAsConfigured, onContinue]);

    const handleGoToSettings = useCallback(() => {
      // 打开设置面板并切换到第一个未配置项所在的 Tab
      const firstCategory = unconfiguredItems[0]?.category;
      if (firstCategory) {
        setStatus("showConfigPanel", true);
      }
      onCancel();
    }, [unconfiguredItems, setStatus, onCancel]);

    return (
      <Modal
        open
        title={unconfiguredItems[0]?.guardPromptTitle ?? "需要先完成配置"}
        onCancel={onCancel}
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              style={{
                padding: "4px 15px",
                background: "transparent",
                color: "rgba(0, 0, 0, 0.88)",
                border: "1px solid #d9d9d9",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
              onClick={handleGoToSettings}
            >
              前往配置
            </button>
            <button
              style={{
                padding: "4px 15px",
                background: "#1677ff",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
              onClick={handleContinue}
            >
              确认并继续
            </button>
          </div>
        }
        width={420}
      >
        <div style={{ marginBottom: 12 }}>
          {unconfiguredItems[0]?.guardPromptDescription ??
            "以下配置项尚未设置，可能影响功能使用："}
        </div>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {unconfiguredItems.map((item) => {
            const currentValue = getCurrentValueLabel(item);
            return (
              <li key={item.key} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                {currentValue != null && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(0,0,0,0.45)",
                      marginLeft: 8,
                    }}
                  >
                    （当前：{currentValue}）
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Modal>
    );
  },
);

export default GuardPromptModal;

/**异步检查守卫并弹窗引导
 * @returns true = 放行, false = 阻止
 */
export function useGuardCheck(): (action: string) => Promise<boolean> {
  const [guardState, setGuardState] = useState<{
    action: string;
    items: ConfigItemDef[];
    onContinue: () => void;
  } | null>(null);

  const checkAndPrompt = useCallback((action: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const result = checkGuard(action);
      if (result.passed) {
        resolve(true);
        return;
      }
      setGuardState({
        action,
        items: result.unconfiguredItems,
        onContinue: () => {
          setGuardState(null);
          resolve(true);
        },
      });
    });
  }, []);

  // 这个 hook 返回的函数用于触发检查
  // GuardPromptModal 的渲染由调用方自行处理
  return checkAndPrompt;
}

/**用于非 React 上下文的守卫检查（如直接在事件处理器中使用）
 * 返回守卫结果，弹窗由调用方渲染
 */
export { checkGuard };
