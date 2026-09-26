import { Toaster } from "sonner";
import type { useLauncher } from "../model";

export function LauncherFeedback({
  model: m,
}: {
  model: ReturnType<typeof useLauncher>;
}) {
  return (
    <Toaster
      className="launcher-feedback"
      theme={m.snapshot?.settings.theme === "light" ? "light" : "dark"}
      position="top-right"
      offset={{ top: 24, right: 24 }}
      mobileOffset={16}
      closeButton
      containerAriaLabel="操作通知"
      toastOptions={{ closeButtonAriaLabel: "关闭通知" }}
    />
  );
}
