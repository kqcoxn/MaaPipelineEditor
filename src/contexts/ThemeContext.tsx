import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  enable as enableDarkMode,
  disable as disableDarkMode,
} from "darkreader";
import { useConfigStore } from "../stores/configStore";

/**
 * 主题上下文接口
 */
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * 主题提供者组件
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const useDarkMode = useConfigStore((state) => state.configs.useDarkMode);
  const setConfig = useConfigStore((state) => state.setConfig);

  // 同步主题状态到 darkreader
  useEffect(() => {
    if (useDarkMode) {
      enableDarkMode({
        brightness: 100,
        contrast: 90,
        sepia: 10,
      });
    } else {
      disableDarkMode();
    }
  }, [useDarkMode]);

  const toggleTheme = () => {
    setConfig("useDarkMode", !useDarkMode);
  };

  const setTheme = (isDark: boolean) => {
    setConfig("useDarkMode", isDark);
  };

  const value: ThemeContextType = {
    isDark: useDarkMode,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * 使用主题的 Hook
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
