import {
  App as AntdApp,
  message as staticMessage,
  Modal as StaticModal,
  notification as staticNotification,
} from "antd";

type AntdAppApi = ReturnType<typeof AntdApp.useApp>;

let currentAppApi: AntdAppApi | null = null;

export function setAntdAppApi(appApi: AntdAppApi | null): void {
  currentAppApi = appApi;
}

export function getAntdAppApi(): AntdAppApi | null {
  return currentAppApi;
}

function createContextApiProxy<T extends object>(
  getContextApi: (appApi: AntdAppApi) => T,
  fallbackApi: T,
): T {
  return new Proxy(fallbackApi, {
    get: (_target, property) => {
      const owner = currentAppApi ? getContextApi(currentAppApi) : fallbackApi;
      return Reflect.get(owner, property);
    },
  });
}

export const message = createContextApiProxy(
  (appApi) => appApi.message,
  staticMessage,
);

export const notification = createContextApiProxy(
  (appApi) => appApi.notification,
  staticNotification,
);

export const modal = createContextApiProxy(
  (appApi) => appApi.modal,
  StaticModal,
);
