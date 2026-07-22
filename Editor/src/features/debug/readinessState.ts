import { useDebugRunProfileStore } from "../../stores/debugRunProfileStore";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useResourceStore } from "../../stores/resourceStore";
import { useMFWStore } from "../../stores/mfwStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useWSStore } from "../../stores/wsStore";
import { getDebugReadiness, type DebugReadiness } from "./readiness";
import { makeDebugResourceKey } from "../../stores/debugRunProfileStore";

export interface CurrentDebugReadiness {
  readiness: DebugReadiness;
  resourceKey: string;
  resourcePreflight: ReturnType<
    typeof useDebugSessionStore.getState
  >["resourcePreflight"];
  resourcePreflightMatches: boolean;
}

export function getCurrentDebugReadiness(): CurrentDebugReadiness {
  const sessionState = useDebugSessionStore.getState();
  const profileState = useDebugRunProfileStore.getState();
  const resourceState = useResourceStore.getState();
  const mfwState = useMFWStore.getState();
  const resourceKey = makeDebugResourceKey(
    profileState.profile.resourcePaths,
    resourceState.resourceBundles,
  );
  const resourcePreflight = sessionState.resourcePreflight;
  const resourcePreflightMatches = resourcePreflight.resourceKey === resourceKey;

  return {
    readiness: getDebugReadiness({
      localBridgeConnected: useWSStore.getState().connected,
      workspaceState: useWorkspaceStore.getState().state,
      deviceConnectionStatus: mfwState.connectionStatus,
      controllerId: mfwState.controllerId,
      resourceStatus: resourcePreflightMatches
        ? resourcePreflight.status
        : "idle",
      resourceError: resourcePreflightMatches
        ? resourcePreflight.error
        : undefined,
    }),
    resourceKey,
    resourcePreflight,
    resourcePreflightMatches,
  };
}
