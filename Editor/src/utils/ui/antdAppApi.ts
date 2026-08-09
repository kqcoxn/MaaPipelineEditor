import { App as AntdApp } from "antd";

type AntdAppApi = ReturnType<typeof AntdApp.useApp>;

let currentAppApi: AntdAppApi | null = null;

export function setAntdAppApi(appApi: AntdAppApi | null): void {
  currentAppApi = appApi;
}

export function getAntdAppApi(): AntdAppApi | null {
  return currentAppApi;
}
