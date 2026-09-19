import { useEffect, useState, useCallback, useRef } from "react";
import type { ControllerConnectionRequest } from "@/services/protocols/controllerConnection";
import { ADB_DEFAULT_INPUT_METHODS, ADB_DEFAULT_SCREENCAP_METHODS, defaultConnectionForm, restoreConnectionForm, type ConnectionForm, type ControllerTab } from "./connectionForm";

const STORAGE_KEY = "mpe_connection_form";
type SavedDrafts = { activeTab?: ControllerTab; drafts?: Partial<Record<ControllerTab, ConnectionForm>> };

function readDrafts(): SavedDrafts {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

/** 表单独立于已生效配置；仅在打开面板或控制器更换时由父组件重新初始化。 */
export function useConnectionForm(availableTabs: ControllerTab[], applied: ControllerConnectionRequest | null) {
  const [saved] = useState(readDrafts);
  const [form, setForm] = useState<ConnectionForm>(() => {
    const activeTab = applied?.type || (saved.activeTab && availableTabs.includes(saved.activeTab) ? saved.activeTab : availableTabs[0]);
    const initial = { ...defaultConnectionForm(activeTab), ...saved.drafts?.[activeTab], activeTab };
    return applied ? restoreConnectionForm(initial, applied) : initial;
  });
  const tabDrafts = useRef<Partial<Record<ControllerTab, ConnectionForm>>>(saved.drafts || {});
  useEffect(() => {
    tabDrafts.current[form.activeTab] = form;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeTab: form.activeTab, drafts: tabDrafts.current }));
    } catch { /* 忽略存储不可用。 */ }
  }, [form]);
  const update = useCallback(<K extends keyof ConnectionForm>(key: K, value: ConnectionForm[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
  }, []);

  return {
    ...form,
    form,
    isAdbManualMode: !!(form.manualAdbPath.trim() || form.manualAddress.trim()),
    setActiveTab: (activeTab: ControllerTab) => {
      tabDrafts.current[form.activeTab] = form;
      setForm(tabDrafts.current[activeTab] || { ...defaultConnectionForm(activeTab),
        customScreencap: activeTab === "adb" ? ADB_DEFAULT_SCREENCAP_METHODS : "FramePool",
        customInput: activeTab === "adb" ? ADB_DEFAULT_INPUT_METHODS : "SendMessageWithCursorPos",
      });
    },
    setSelectedAdbDevice: (device: ConnectionForm["selectedAdbDevice"]) => setForm(previous => ({ ...previous,
      selectedAdbDevice: device, manualName: "",
      customScreencap: device?.screencap_methods.filter(method => method !== "RawByNetcat") || ADB_DEFAULT_SCREENCAP_METHODS,
      customInput: device?.input_methods || ADB_DEFAULT_INPUT_METHODS,
    })),
    setSelectedWin32Window: (window: ConnectionForm["selectedWin32Window"]) => setForm(previous => ({ ...previous,
      selectedWin32Window: window,
      customScreencap: window?.screencap_methods.includes("FramePool") ? "FramePool" : window?.screencap_methods[0],
      customInput: window?.input_methods.includes("SendMessageWithCursorPos") ? "SendMessageWithCursorPos" : window?.input_methods[0],
    })),
    setSelectedLinuxSocket: (value: ConnectionForm["selectedLinuxSocket"]) => update("selectedLinuxSocket", value),
    setLinuxSocketPath: (value: ConnectionForm["linuxSocketPath"]) => update("linuxSocketPath", value),
    setManualAdbPath: (value: ConnectionForm["manualAdbPath"]) => update("manualAdbPath", value),
    setManualAddress: (value: ConnectionForm["manualAddress"]) => update("manualAddress", value),
    setManualConfig: (value: ConnectionForm["manualConfig"]) => update("manualConfig", value),
    setManualName: (value: ConnectionForm["manualName"]) => update("manualName", value),
    setPlayCoverAddress: (value: ConnectionForm["playCoverAddress"]) => update("playCoverAddress", value),
    setPlayCoverUUID: (value: ConnectionForm["playCoverUUID"]) => update("playCoverUUID", value),
    setPlayCoverName: (value: ConnectionForm["playCoverName"]) => update("playCoverName", value),
    setGamepadType: (value: ConnectionForm["gamepadType"]) => update("gamepadType", value),
    setGamepadHwnd: (value: ConnectionForm["gamepadHwnd"]) => update("gamepadHwnd", value),
    setGamepadScreencap: (value: ConnectionForm["gamepadScreencap"]) => update("gamepadScreencap", value),
    setMacosScreencap: (value: ConnectionForm["macosScreencap"]) => update("macosScreencap", value),
    setMacosInput: (value: ConnectionForm["macosInput"]) => update("macosInput", value),
    setLinuxOptions: (value: ConnectionForm["linuxOptions"]) => update("linuxOptions", value),
    setLinuxUseWin32VkCode: (value: ConnectionForm["linuxUseWin32VkCode"]) => update("linuxUseWin32VkCode", value),
    setCustomScreencap: (value: ConnectionForm["customScreencap"]) => update("customScreencap", value),
    setCustomInput: (value: ConnectionForm["customInput"]) => update("customInput", value),
    setCustomKeyboard: (value: ConnectionForm["customKeyboard"]) => update("customKeyboard", value),
  };
}
