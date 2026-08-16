import { CANVAS_CHAT_POLICY } from "./constants";
import type {
  BusinessProfile,
  CapabilityPack,
  ToolDefinition,
} from "./types";

function cloneAndFreeze<T>(value: T): Readonly<T> {
  const clone = structuredClone(value);
  const freeze = (target: unknown): unknown => {
    if (!target || typeof target !== "object" || Object.isFrozen(target)) {
      return target;
    }
    Object.values(target).forEach(freeze);
    return Object.freeze(target);
  };
  return freeze(clone) as Readonly<T>;
}

export class HarnessRegistry {
  private readonly profiles = new Map<string, Readonly<BusinessProfile>>();
  private readonly capabilityPacks = new Map<
    string,
    Readonly<CapabilityPack>
  >();
  private readonly tools = new Map<string, Readonly<ToolDefinition>>();

  registerProfile(profile: BusinessProfile): void {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Business Profile 已注册: ${profile.id}`);
    }
    this.profiles.set(profile.id, cloneAndFreeze(profile));
  }

  registerCapabilityPack(capabilityPack: CapabilityPack): void {
    if (this.capabilityPacks.has(capabilityPack.id)) {
      throw new Error(`Capability Pack 已注册: ${capabilityPack.id}`);
    }
    this.capabilityPacks.set(capabilityPack.id, cloneAndFreeze(capabilityPack));
  }

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具已注册: ${tool.name}`);
    }
    this.tools.set(tool.name, cloneAndFreeze(tool));
  }

  getProfile(id: string): Readonly<BusinessProfile> {
    const profile = this.profiles.get(id);
    if (!profile) throw new Error(`未知 Business Profile: ${id}`);
    return profile;
  }

  getCapabilityPack(id: string): Readonly<CapabilityPack> {
    const capabilityPack = this.capabilityPacks.get(id);
    if (!capabilityPack) throw new Error(`未知 Capability Pack: ${id}`);
    return capabilityPack;
  }

  getTool(name: string): Readonly<ToolDefinition> | undefined {
    return this.tools.get(name);
  }

  snapshotProfile(id: string): Readonly<BusinessProfile> {
    return cloneAndFreeze(this.getProfile(id));
  }

  snapshotCapabilityPack(id: string): Readonly<CapabilityPack> {
    return cloneAndFreeze(this.getCapabilityPack(id));
  }
}

export const canvasChatProfile: BusinessProfile = {
  id: "canvas-chat",
  version: "1.0.0",
  name: "画布对话",
  description: "查询并受控修改当前文件的 Pipeline 画布",
  capabilityPackId: "canvas",
  maxSessionMessages: 20,
  systemPrompt:
    "你是 MPE 画布助手。必须通过已提供的工具读取和修改画布，不得声称执行未实际执行的操作。",
  defaultPolicy: CANVAS_CHAT_POLICY,
};

