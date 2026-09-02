import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useWSStore } from "@/stores/connection/wsStore";

const serverMocks = vi.hoisted(() => {
  const statusListeners = new Set<(connected: boolean) => void>();
  const connectingListeners = new Set<(connecting: boolean) => void>();

  return {
    autoConnectLastController: vi.fn(),
    connecting: false,
    connected: false,
    connectingListeners,
    resetDebugState: vi.fn(),
    statusListeners,
  };
});

vi.mock("./server", () => ({
  localServer: {
    getIsConnecting: () => serverMocks.connecting,
    isConnected: () => serverMocks.connected,
    onConnecting: (listener: (connecting: boolean) => void) => {
      serverMocks.connectingListeners.add(listener);
      return () => serverMocks.connectingListeners.delete(listener);
    },
    onStatus: (listener: (connected: boolean) => void) => {
      serverMocks.statusListeners.add(listener);
      return () => serverMocks.statusListeners.delete(listener);
    },
  },
  mfwProtocol: {
    autoConnectLastController: serverMocks.autoConnectLastController,
  },
}));
vi.mock("@/features/debug/protocols/registerProtocolListeners", () => ({
  resetDebugProtocolStateForConnectionLoss: serverMocks.resetDebugState,
}));

import { initializeLocalBridgeConnectionState } from "./localBridgeConnection";

describe("initializeLocalBridgeConnectionState", () => {
  beforeEach(() => {
    serverMocks.autoConnectLastController.mockClear();
    serverMocks.resetDebugState.mockClear();
    serverMocks.statusListeners.clear();
    serverMocks.connectingListeners.clear();
    serverMocks.connected = false;
    serverMocks.connecting = true;
    useWSStore.setState({ connected: true, connecting: false });
    useMFWStore.getState().setControllerInfo("adb", "controller", {
      name: "device",
    });
  });

  it("syncs service events into the stores and preserves connection side effects", () => {
    const dispose = initializeLocalBridgeConnectionState();

    expect(useWSStore.getState()).toMatchObject({
      connected: false,
      connecting: true,
    });

    serverMocks.connectingListeners.forEach((listener) => listener(false));
    serverMocks.statusListeners.forEach((listener) => listener(true));
    expect(useWSStore.getState()).toMatchObject({
      connected: true,
      connecting: false,
    });
    expect(serverMocks.autoConnectLastController).toHaveBeenCalledOnce();

    serverMocks.statusListeners.forEach((listener) => listener(false));
    expect(useWSStore.getState().connected).toBe(false);
    expect(useMFWStore.getState().connectionStatus).toBe("disconnected");
    expect(serverMocks.resetDebugState).toHaveBeenCalledOnce();

    dispose();
  });

  it("returns listener counts to zero after repeated initialization", () => {
    const disposeFirst = initializeLocalBridgeConnectionState();
    expect(serverMocks.statusListeners.size).toBe(1);
    expect(serverMocks.connectingListeners.size).toBe(1);

    disposeFirst();
    expect(serverMocks.statusListeners.size).toBe(0);
    expect(serverMocks.connectingListeners.size).toBe(0);

    const disposeSecond = initializeLocalBridgeConnectionState();
    expect(serverMocks.statusListeners.size).toBe(1);
    expect(serverMocks.connectingListeners.size).toBe(1);

    disposeSecond();
    expect(serverMocks.statusListeners.size).toBe(0);
    expect(serverMocks.connectingListeners.size).toBe(0);
  });
});
