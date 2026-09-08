import { expect, it } from "vitest";
import { useTermsStore, isTermsAccepted } from "@/stores/ui/termsStore";
import { subscribeAchievementEvents } from "./bus";

it("打开和勾选协议不解锁，接受协议并保存后才发出成就事件", () => {
  localStorage.clear();
  const events: string[] = [];
  const dispose = subscribeAchievementEvents((event) => {
    events.push(event.type);
    expect(isTermsAccepted()).toBe(true);
  });
  try {
    useTermsStore.getState().openModal();
    useTermsStore.getState().toggleItem("test");
    expect(events).toEqual([]);
    useTermsStore.getState().acceptTerms();
    expect(events).toEqual(["achievement:terms_accepted"]);
    expect(useTermsStore.getState().modalOpen).toBe(false);
  } finally {
    dispose();
    localStorage.clear();
  }
});
