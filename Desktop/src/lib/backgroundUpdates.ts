import type { Snapshot, VersionList } from "../types";
import { automaticUpdateBlock, newer } from "./automaticUpdate";
import { UPDATE_CANCELLED } from "./checkCancellation";
import { UpdateHistory, type UpdateTarget } from "./updateHistory";

type Ports = {
  snapshot: () => Snapshot | undefined;
  refresh: () => Promise<Snapshot>;
  busy: () => boolean;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  checkMpe: (force: boolean) => Promise<VersionList>;
  checkDesktop: (cached: boolean) => Promise<boolean>;
  installMpe: (snapshot: Snapshot, list: VersionList) => Promise<string>;
  installDesktop: () => Promise<string>;
  onMpe: (list: VersionList) => void;
  onDesktop: (available: boolean) => void;
  onChecking: (target: UpdateTarget) => void;
  onError: (target: UpdateTarget, error: unknown) => void;
};

/** Network work never uses run(); only installation enters the operation gate. */
export class BackgroundUpdates {
  private active?: Promise<void>;
  private requested = new Map<UpdateTarget, boolean>();
  private generation = { mpe: 0, desktop: 0 };
  private stopped = false;
  private deferred = false;
  private manual = new Set<UpdateTarget>();
  private publishedMpe?: VersionList;
  constructor(
    readonly history: UpdateHistory,
    private ports: Ports,
  ) {}

  // Manual actions supersede in-flight background responses.
  supersede(target: UpdateTarget) {
    this.generation[target]++;
    this.manual.add(target);
  }
  cancel() {
    for (const target of ["mpe", "desktop"] as const) {
      this.supersede(target);
      this.history.fail(target);
    }
  }
  stop() {
    this.stopped = true;
    this.requested.clear();
  }
  resume() {
    if (!this.deferred || this.stopped) return;
    this.deferred = false;
    void this.enqueue("all", false);
  }
  request(target: UpdateTarget | "all" = "all", force = false): Promise<void> {
    if (target === "all") this.manual.clear();
    else this.manual.delete(target);
    return this.enqueue(target, force);
  }
  private enqueue(target: UpdateTarget | "all", force: boolean): Promise<void> {
    if (this.stopped) return Promise.resolve();
    for (const item of ["desktop", "mpe"] as const) {
      if (target === "all" || target === item)
        this.requested.set(item, force || this.requested.get(item) === true);
    }
    if (!this.active) {
      this.start();
    }
    return this.active!;
  }
  private start(): Promise<void> {
    this.active = this.drain().finally(() => {
      this.active = undefined;
      // A request can arrive after drain's last loop but before this callback.
      if (this.requested.size && !this.stopped) return this.start();
    });
    return this.active;
  }
  private enabled(target: UpdateTarget, s: Snapshot) {
    return target === "mpe"
      ? s.settings.autoCheckMpe
      : s.settings.onboardingDone && s.settings.autoUpdateDesktop;
  }
  private async drain() {
    while (this.requested.size && !this.stopped) {
      const requested = [...this.requested];
      this.requested.clear();
      const s = this.ports.snapshot();
      if (!s) continue;
      if (this.history.mpe && this.publishedMpe !== this.history.mpe) {
        this.publishedMpe = this.history.mpe;
        this.ports.onMpe(this.history.mpe);
      }
      // Independent checks may complete in either order; installation keeps host priority.
      await Promise.all(
        requested.map(async ([target, force]) => {
          if (!this.enabled(target, s)) return;
          if (!force && !this.history.due(target)) return;
          const generation = this.generation[target];
          this.ports.onChecking(target);
          try {
            if (target === "mpe") {
              const list = await this.ports.checkMpe(force);
              if (this.stopped || generation !== this.generation[target])
                return;
              this.history.recordMpe(list);
              this.publishedMpe = list;
              this.ports.onMpe(list);
            } else {
              const available = await this.ports.checkDesktop(false);
              if (this.stopped || generation !== this.generation[target])
                return;
              this.history.recordDesktop(available);
              this.ports.onDesktop(available);
            }
          } catch (error) {
            if (this.stopped || generation !== this.generation[target]) return;
            this.history.fail(target);
            this.ports.onError(target, error);
          }
        }),
      );
      if (!this.stopped && !this.requested.size) await this.installPending();
    }
  }
  private pendingMpe(s: Snapshot) {
    const list = this.history.mpe;
    return (
      !this.manual.has("mpe") &&
      this.enabled("mpe", s) &&
      !this.history.due("mpe") &&
      this.history.canInstall("mpe") &&
      !automaticUpdateBlock(s) &&
      !s.settings.fixedVersion &&
      s.environment.ready &&
      !!list &&
      !list.stale &&
      !!list.versions[0] &&
      newer(list.versions[0], s.environment.version)
    );
  }
  private pendingDesktop(s: Snapshot) {
    return (
      !this.manual.has("desktop") &&
      this.enabled("desktop", s) &&
      !this.history.due("desktop") &&
      this.history.canInstall("desktop") &&
      this.history.desktop === true
    );
  }
  private async installPending() {
    let s = this.ports.snapshot();
    if (!s || s.running || s.service.state !== "stopped") return;
    if (!this.pendingDesktop(s) && !this.pendingMpe(s)) return;
    if (this.ports.busy()) {
      this.deferred = true;
      return;
    }
    // The plugin's Update object lives in Rust memory. Restore it in the background
    // after restarting the launcher, without blocking editor launch on networking.
    if (this.pendingDesktop(s)) {
      const generation = this.generation.desktop;
      try {
        const available = await this.ports.checkDesktop(true);
        if (this.stopped) return;
        if (generation === this.generation.desktop && !available) {
          this.history.recordDesktop(false);
          this.ports.onDesktop(false);
        }
      } catch (error) {
        if (!this.stopped && generation === this.generation.desktop) {
          this.history.fail("desktop");
          this.ports.onError("desktop", error);
        }
      }
    }
    if (this.stopped) return;
    if (this.ports.busy()) {
      this.deferred = true;
      return;
    }
    await this.ports.run(async () => {
      // Re-read settings, service and session after all network work and before
      // installing. Rust independently rechecks under its operation lock.
      s = await this.ports.refresh();
      if (this.stopped || s.running || s.service.state !== "stopped" || s.busy)
        return;
      for (const target of ["desktop", "mpe"] as const) {
        if (
          target === "desktop" ? !this.pendingDesktop(s) : !this.pendingMpe(s)
        )
          continue;
        try {
          const status =
            target === "desktop"
              ? await this.ports.installDesktop()
              : await this.ports.installMpe(s, this.history.mpe!);
          if (status === UPDATE_CANCELLED) {
            this.history.fail("desktop");
            this.history.fail("mpe");
            return;
          }
          if (target === "desktop") this.history.recordDesktop(false);
        } catch (error) {
          this.history.fail(target);
          this.ports.onError(target, error);
        }
      }
    });
  }
}
