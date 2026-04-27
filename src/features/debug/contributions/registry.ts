import type { DebugRunMode } from "../types";

export interface DebugRunModeContribution {
  id: DebugRunMode;
  label: string;
  description: string;
  p0Available: boolean;
}

class DebugContributionRegistry {
  private readonly runModes = new Map<DebugRunMode, DebugRunModeContribution>();

  registerRunMode(contribution: DebugRunModeContribution): void {
    this.runModes.set(contribution.id, contribution);
  }

  getRunMode(id: DebugRunMode): DebugRunModeContribution | undefined {
    return this.runModes.get(id);
  }

  getRunModes(): DebugRunModeContribution[] {
    return [...this.runModes.values()];
  }
}

export const debugContributionRegistry = new DebugContributionRegistry();
