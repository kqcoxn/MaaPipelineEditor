import { useMFWStore } from "@/stores/connection/mfwStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { resetDebugProtocolStateForConnectionLoss } from "@/features/debug/protocols/registerProtocolListeners";
import { localServer, mfwProtocol } from "./server";

export function initializeLocalBridgeConnectionState(): () => void {
  const setConnected = useWSStore.getState().setConnected;
  const setConnecting = useWSStore.getState().setConnecting;

  setConnected(localServer.isConnected());
  setConnecting(localServer.getIsConnecting());

  const unsubscribeStatus = localServer.onStatus((connected) => {
    setConnected(connected);
    const mfwState = useMFWStore.getState();

    if (connected) {
      if (mfwState.controllerId) mfwState.clearConnection();
      mfwProtocol.autoConnectLastController();
      return;
    }

    mfwState.clearConnection();
    resetDebugProtocolStateForConnectionLoss();
  });
  const unsubscribeConnecting = localServer.onConnecting(setConnecting);

  return () => {
    unsubscribeStatus();
    unsubscribeConnecting();
  };
}
