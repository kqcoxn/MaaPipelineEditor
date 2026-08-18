import { HarnessRegistry } from "../core/registry";
import type { HarnessModule, ToolHandler } from "../core/types";

export interface RegisteredHarnessModules {
  registry: HarnessRegistry;
  toolHandlers: Readonly<Record<string, ToolHandler>>;
}

export function registerHarnessModules(
  modules: readonly HarnessModule[],
): RegisteredHarnessModules {
  const registry = new HarnessRegistry();
  const toolHandlers = Object.create(null) as Record<string, ToolHandler>;

  modules.forEach((module) => {
    module.skills?.forEach((skill) => registry.registerSkill(skill));
    module.tools?.forEach((tool) => registry.registerTool(tool));
    module.capabilityPacks?.forEach((pack) =>
      registry.registerCapabilityPack(pack),
    );
    module.profiles?.forEach((profile) => registry.registerProfile(profile));
    Object.entries(module.toolHandlers ?? {}).forEach(([name, handler]) => {
      if (Object.hasOwn(toolHandlers, name)) {
        throw new Error(`工具 Handler 已注册: ${name}`);
      }
      toolHandlers[name] = handler;
    });
  });

  return { registry, toolHandlers };
}
