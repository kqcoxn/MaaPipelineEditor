import type { DebugModalPanel, DebugRunMode } from "../types";

export interface DebugRunModeContribution {
  id: DebugRunMode;
  label: string;
  description: string;
  p0Available: boolean;
}

export interface DebugModalPanelContribution {
  id: DebugModalPanel;
  label: string;
  order: number;
}

export interface DebugArtifactViewerContribution {
  id: string;
  label: string;
  mimePrefix?: string;
  artifactType?: string;
}

export interface CanvasDebugOverlayContribution {
  id: string;
  label: string;
}

export interface NodeDebugActionContribution {
  id: string;
  label: string;
  runMode: DebugRunMode;
}

class DebugContributionRegistry {
  private readonly runModes = new Map<DebugRunMode, DebugRunModeContribution>();
  private readonly modalPanels = new Map<
    DebugModalPanel,
    DebugModalPanelContribution
  >();
  private readonly artifactViewers = new Map<
    string,
    DebugArtifactViewerContribution
  >();
  private readonly canvasOverlays = new Map<
    string,
    CanvasDebugOverlayContribution
  >();
  private readonly nodeDebugActions = new Map<
    string,
    NodeDebugActionContribution
  >();

  registerRunMode(contribution: DebugRunModeContribution): void {
    this.runModes.set(contribution.id, contribution);
  }

  getRunMode(id: DebugRunMode): DebugRunModeContribution | undefined {
    return this.runModes.get(id);
  }

  getRunModes(): DebugRunModeContribution[] {
    return [...this.runModes.values()];
  }

  registerModalPanel(contribution: DebugModalPanelContribution): void {
    this.modalPanels.set(contribution.id, contribution);
  }

  getModalPanels(): DebugModalPanelContribution[] {
    return [...this.modalPanels.values()].sort((a, b) => a.order - b.order);
  }

  registerArtifactViewer(contribution: DebugArtifactViewerContribution): void {
    this.artifactViewers.set(contribution.id, contribution);
  }

  getArtifactViewers(): DebugArtifactViewerContribution[] {
    return [...this.artifactViewers.values()];
  }

  registerCanvasOverlay(contribution: CanvasDebugOverlayContribution): void {
    this.canvasOverlays.set(contribution.id, contribution);
  }

  getCanvasOverlays(): CanvasDebugOverlayContribution[] {
    return [...this.canvasOverlays.values()];
  }

  registerNodeDebugAction(contribution: NodeDebugActionContribution): void {
    this.nodeDebugActions.set(contribution.id, contribution);
  }

  getNodeDebugActions(): NodeDebugActionContribution[] {
    return [...this.nodeDebugActions.values()];
  }
}

export const debugContributionRegistry = new DebugContributionRegistry();
