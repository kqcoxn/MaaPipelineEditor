import { App as AntdApp } from "antd";
import { useLayoutEffect } from "react";
import { setAntdAppApi } from "../utils/ui/antdAppApi";

export function AntdFeedbackBridge() {
  const appApi = AntdApp.useApp();

  useLayoutEffect(() => {
    setAntdAppApi(appApi);
    return () => setAntdAppApi(null);
  }, [appApi]);

  return null;
}
