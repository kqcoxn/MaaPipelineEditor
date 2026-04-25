import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "mpe_conn_";

/**
 * 带 localStorage 持久化的 useState
 * 值变化时自动保存，初始化时自动恢复
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [storageKey, state]);

  return [state, setState];
}
