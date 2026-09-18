import { afterEach, describe, expect, it, vi } from "vitest";
import { revealWhenReady } from "./startup";

afterEach(() => vi.useRealTimers());

describe("launcher first-screen readiness", () => {
  it("reveals as soon as local assets finish, without waiting for the deadline", async () => {
    vi.useFakeTimers();
    const reveal = vi.fn();
    revealWhenReady(Promise.resolve(), reveal);
    await vi.advanceTimersByTimeAsync(0);
    expect(reveal).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("does not keep the window hidden when an image fails", async () => {
    vi.useFakeTimers();
    const reveal = vi.fn();
    revealWhenReady(Promise.reject(new Error("missing image")), reveal);
    await vi.advanceTimersByTimeAsync(0);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled image decode and ignores its late completion", async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    const assets = new Promise<void>((done) => {
      resolve = done;
    });
    const reveal = vi.fn();
    revealWhenReady(assets, reveal);
    await vi.advanceTimersByTimeAsync(1499);
    expect(reveal).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reveal).toHaveBeenCalledTimes(1);
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("does not reveal after unmount, even if assets later complete", async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    const assets = new Promise<void>((done) => {
      resolve = done;
    });
    const reveal = vi.fn();
    const cleanup = revealWhenReady(assets, reveal);
    cleanup();
    resolve();
    await vi.advanceTimersByTimeAsync(2000);
    expect(reveal).not.toHaveBeenCalled();
  });
});
