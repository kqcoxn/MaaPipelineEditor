import { Channel, invoke } from "@tauri-apps/api/core";
import { parseInstallProgress, type InstallProgress } from "./installProgress";

export async function updateDesktop(
  onProgress: (progress: InstallProgress) => void,
): Promise<string> {
  let active = true;
  const channel = new Channel<unknown>();
  channel.onmessage = (event) => {
    if (active) onProgress(parseInstallProgress(JSON.stringify(event)));
  };
  try {
    return await invoke<string>("update_desktop", { onProgress: channel });
  } finally {
    // A queued channel message must not restore progress after failure or retry.
    active = false;
  }
}
