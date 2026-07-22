import type { ProjectStatus } from "../../services/generated/bridge-v2";
import { useDocumentStore } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import {
  asProjectId,
  type ProjectIdentity,
} from "../project-session/types";
import { parseProjectPath } from "../project-session/projectPath";
import type { ProjectStorageAdapter } from "./ProjectStorageAdapter";

class ProjectStorageCoordinator {
  private adapter: ProjectStorageAdapter | null = null;
  private unwatch: (() => void) | null = null;

  setAdapter(adapter: ProjectStorageAdapter): void {
    this.unwatch?.();
    this.adapter = adapter;
    const session = useProjectSessionStore.getState();
    const pendingLocalBridge =
      adapter.kind === "localbridge" &&
      adapter.identity.projectId === "localbridge:pending";
    if (pendingLocalBridge) {
      session.setAvailability("connecting", true);
    } else {
      session.establishSession(adapter.identity, adapter.kind);
      session.setCapabilities(adapter.capabilities());
      session.setAvailability("ready", true);
    }
    this.unwatch = adapter.watch((change) => {
      if (change.projectId !== adapter.identity.projectId) return;
      const currentSession = useProjectSessionStore.getState();
      currentSession.applyDocumentMappings(change.documentMappings);
      useDocumentStore.getState().applyDocumentMappings(change.documentMappings);
      useFileStore.getState().applyDocumentIdMappings(change.documentMappings);
      if (change.change === "renamed" && change.newPath) {
        useFileStore
          .getState()
          .renamePath(change.path, change.newPath, change.isDirectory);
      }
      if (change.change !== "modified") {
        void adapter
          .list()
          .then((entries) => useProjectSessionStore.getState().applyEntries(entries))
          .catch((error) =>
            console.error("[ProjectStorageCoordinator] Failed to refresh entries", error),
          );
      }
    });
  }

  updateLocalBridgeIdentity(status: ProjectStatus): void {
    if (!status.available || !status.projectId || !status.projectRoot || !status.interfacePath) {
      useProjectSessionStore.getState().setAvailability("unavailable", false);
      return;
    }
    const adapter = this.adapter;
    if (!adapter || adapter.kind !== "localbridge") return;
    const identity: ProjectIdentity = {
      projectId: asProjectId(status.projectId),
      projectRoot: status.projectRoot,
      interfacePath: parseProjectPath(status.interfacePath),
      name: status.name ?? "",
      label: status.label ?? status.name ?? "",
      version: status.version ?? "",
    };
    Object.assign(adapter.identity, identity);
    useProjectSessionStore.getState().establishSession(identity, adapter.kind);
  }

  getAdapter(): ProjectStorageAdapter | null {
    return this.adapter;
  }

  requireAdapter(): ProjectStorageAdapter {
    if (!this.adapter) throw new Error("当前没有可用的项目存储适配器");
    return this.adapter;
  }

  disconnect(): void {
    useProjectSessionStore.getState().setAvailability("offline", false);
  }

  destroy(): void {
    this.unwatch?.();
    this.unwatch = null;
    this.adapter = null;
    useProjectSessionStore.getState().clearProject();
  }
}

export const projectStorageCoordinator = new ProjectStorageCoordinator();
