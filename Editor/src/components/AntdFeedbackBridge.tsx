import { App as AntdApp } from "antd";
import { useEffect } from "react";
import { setAntdAppApi } from "../utils/ui/antdAppApi";

export function AntdFeedbackBridge() {
  const appApi = AntdApp.useApp();

  useEffect(() => {
    setAntdAppApi(appApi);
    return () => setAntdAppApi(null);
  }, [appApi]);

  return null;
}
