import type { VersionList } from "../types";

export type UpdateTarget = "mpe" | "desktop";
export const CHECK_INTERVAL = 24 * 60 * 60 * 1000;
export const FAILURE_COOLDOWN = 60 * 60 * 1000;
const KEY = "mpe-update-history";
type Entry<T> = { checkedAt: number; failedAt: number; result?: T };
type History = {
  mpe: Entry<VersionList>;
  desktop: Entry<boolean>;
  revision?: string;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

const empty = (): History => ({
  mpe: { checkedAt: 0, failedAt: 0 },
  desktop: { checkedAt: 0, failedAt: 0 },
});
function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function versionList(value: unknown): value is VersionList {
  if (!value || typeof value !== "object") return false;
  const list = value as VersionList;
  return (
    Array.isArray(list.versions) &&
    list.versions.every(
      (v) => typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v),
    ) &&
    timestamp(list.checkedAt) &&
    typeof list.stale === "boolean" &&
    typeof list.cached === "boolean" &&
    ["github", "static"].includes(list.source) &&
    (list.warning === null || typeof list.warning === "string")
  );
}

/** Separate from preferences so a settings save cannot erase a completed check. */
export class UpdateHistory {
  private data = empty();
  constructor(
    private storage: Storage | undefined = (() => {
      try {
        return globalThis.localStorage;
      } catch {
        return undefined;
      }
    })(),
    private now = Date.now,
  ) {
    try {
      const saved = JSON.parse(
        storage?.getItem(KEY) ?? "null",
      ) as History | null;
      if (!saved) return;
      for (const target of ["mpe", "desktop"] as const) {
        const entry = saved[target];
        if (!entry || !timestamp(entry.checkedAt) || !timestamp(entry.failedAt))
          continue;
        if (target === "mpe" && versionList(entry.result))
          this.data.mpe = entry as Entry<VersionList>;
        if (target === "desktop" && typeof entry.result === "boolean")
          this.data.desktop = entry as Entry<boolean>;
        // A failed first check has no result yet, but its cooldown still persists.
        if (entry.result === undefined)
          this.data[target] = { ...entry, result: undefined };
      }
      if (typeof saved.revision === "string")
        this.data.revision = saved.revision;
    } catch {
      /* A missing or damaged cache simply schedules a fresh check. */
    }
  }
  private save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* Keep in-memory state. */
    }
  }
  setRevision(revision: string) {
    if (this.data.revision === revision) return;
    this.data.desktop = { checkedAt: 0, failedAt: 0 };
    this.data.revision = revision;
    this.save();
  }
  get mpe() {
    return this.data.mpe.result;
  }
  get desktop() {
    return this.data.desktop.result;
  }
  private elapsed(time: number, interval: number) {
    return time === 0 || time > this.now() || this.now() - time >= interval;
  }
  due(target: UpdateTarget) {
    const entry = this.data[target];
    return entry.failedAt
      ? this.elapsed(entry.failedAt, FAILURE_COOLDOWN)
      : this.elapsed(entry.checkedAt, CHECK_INTERVAL);
  }
  canInstall(target: UpdateTarget) {
    return this.elapsed(this.data[target].failedAt, FAILURE_COOLDOWN);
  }
  recordMpe(result: VersionList) {
    this.data.mpe.result = result;
    if (result.stale) return this.fail("mpe");
    this.data.mpe.checkedAt = result.checkedAt * 1000;
    this.data.mpe.failedAt = 0;
    this.save();
  }
  recordDesktop(available: boolean) {
    this.data.desktop = {
      result: available,
      checkedAt: this.now(),
      failedAt: 0,
    };
    this.save();
  }
  fail(target: UpdateTarget) {
    this.data[target].failedAt = this.now();
    this.save();
  }
}
