import type {
  CapabilityPack,
  BusinessProfile,
  HarnessSkill,
  ToolDefinition,
} from "./types";

export const ALL_REGISTERED_CAPABILITIES_PACK_ID = "*";

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
  private readonly skills = new Map<string, Readonly<HarnessSkill>>();

  registerProfile(profile: BusinessProfile): void {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Business Profile 已注册: ${profile.id}`);
    }
    this.profiles.set(profile.id, cloneAndFreeze(profile));
  }

  registerCapabilityPack(capabilityPack: CapabilityPack): void {
    if (capabilityPack.id === ALL_REGISTERED_CAPABILITIES_PACK_ID) {
      throw new Error("Capability Pack ID * 为全部注册 Skill 与工具保留");
    }
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

  registerSkill(skill: HarnessSkill): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill 已注册: ${skill.id}`);
    }
    this.skills.set(skill.id, cloneAndFreeze(skill));
  }

  getProfile(id: string): Readonly<BusinessProfile> {
    const profile = this.profiles.get(id);
    if (!profile) throw new Error(`未知 Business Profile: ${id}`);
    return profile;
  }

  getCapabilityPack(id: string): Readonly<CapabilityPack> {
    if (id === ALL_REGISTERED_CAPABILITIES_PACK_ID) {
      return cloneAndFreeze({
        id,
        version: "runtime",
        description: "Run 创建时已注册的全部 MPE Skill 与工具",
        skillIds: [...this.skills.keys()],
        toolNames: [...this.tools.keys()],
      });
    }
    const capabilityPack = this.capabilityPacks.get(id);
    if (!capabilityPack) throw new Error(`未知 Capability Pack: ${id}`);
    return capabilityPack;
  }

  getTool(name: string): Readonly<ToolDefinition> | undefined {
    return this.tools.get(name);
  }

  getSkill(id: string): Readonly<HarnessSkill> | undefined {
    return this.skills.get(id);
  }

  snapshotProfile(id: string): Readonly<BusinessProfile> {
    return cloneAndFreeze(this.getProfile(id));
  }

  snapshotCapabilityPack(id: string): Readonly<CapabilityPack> {
    return cloneAndFreeze(this.getCapabilityPack(id));
  }
}
