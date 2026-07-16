import type { DebugRunMode, DebugRunRequest } from "./types";

export interface DebugStartCommand {
  mode: DebugRunMode;
  nodeId?: string;
  input?: DebugRunRequest["input"];
}

export interface DebugStopCommand {
  reason?: string;
}

export interface DebugCommandHandler {
  start(command: DebugStartCommand): Promise<void> | void;
  stop(command: DebugStopCommand): Promise<void> | void;
}

export class DebugCommandBus {
  private handler?: DebugCommandHandler;

  register(handler: DebugCommandHandler): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = undefined;
    };
  }

  async start(command: DebugStartCommand): Promise<boolean> {
    if (!this.handler) return false;
    await this.handler.start(command);
    return true;
  }

  async stop(command: DebugStopCommand = {}): Promise<boolean> {
    if (!this.handler) return false;
    await this.handler.stop(command);
    return true;
  }
}

export const debugCommandBus = new DebugCommandBus();
