import { App, ConfigProvider } from "antd";
import type { ReactNode } from "react";

const modalDefaults = {
  centered: true,
} as const;

export function AntDesignProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider modal={modalDefaults}>
      <App style={{ display: "contents" }}>{children}</App>
    </ConfigProvider>
  );
}

export function configureAntDesignStaticHolders() {
  ConfigProvider.config({
    holderRender: (children) => (
      <AntDesignProvider>{children}</AntDesignProvider>
    ),
  });
}
