import { ConfigProvider } from "antd";
import type { ReactNode } from "react";

const modalDefaults = {
  centered: true,
} as const;

export function AntDesignProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider modal={modalDefaults}>{children}</ConfigProvider>
  );
}

export function configureAntDesignStaticHolders() {
  ConfigProvider.config({
    holderRender: (children) => (
      <AntDesignProvider>{children}</AntDesignProvider>
    ),
  });
}
