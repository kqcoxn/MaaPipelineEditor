import { useProcessStore } from "@/stores/ui/processStore";

import { ProcessIndicator } from "./ProcessIndicator";

export function GlobalProcessOverlay() {
  const process = useProcessStore(
    (state) => state.entries[state.entries.length - 1],
  );

  return process ? (
    <ProcessIndicator
      label={process.label}
      detail={process.detail}
      progress={process.progress}
    />
  ) : null;
}
