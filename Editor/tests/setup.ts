import "@testing-library/jest-dom/vitest";

// Ant Design X checks Notification at module initialization. happy-dom does
// not provide the browser API, so supply the minimal contract used by tests.
if (typeof globalThis.Notification === "undefined") {
  class TestNotification {
    static permission = "default" as NotificationPermission;
    static requestPermission = async (): Promise<NotificationPermission> =>
      "default";
    onclick: ((event: Event) => void) | null = null;
    onshow: ((event: Event) => void) | null = null;
    onclose: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(public readonly title: string) {}

    close(): void {
      this.onclose?.(new Event("close"));
    }
  }

  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value: TestNotification,
  });
}

// happy-dom does not resolve several layout-only CSS values. Ant Design's
// textarea autosize parser expects numeric padding and border widths.
const originalGetComputedStyle = window.getComputedStyle.bind(window);
const numericLayoutProperties = new Set([
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "border-top-width",
  "border-bottom-width",
]);
window.getComputedStyle = ((element: Element, pseudoElement?: string | null) => {
  const computed = originalGetComputedStyle(element, pseudoElement);
  const originalGetPropertyValue = computed.getPropertyValue.bind(computed);
  Object.defineProperty(computed, "getPropertyValue", {
    configurable: true,
    value: (property: string) => {
      const value = originalGetPropertyValue(property);
      if (
        numericLayoutProperties.has(property) &&
        !Number.isFinite(Number.parseFloat(value))
      ) {
        return "0px";
      }
      return value;
    },
  });
  return computed;
}) as typeof window.getComputedStyle;
