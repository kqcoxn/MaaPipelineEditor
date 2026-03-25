import { useEffect, useState } from "react";

import type { ActionLink, NavItem } from "@/content/landing";

type MobileNavProps = {
  navItems: NavItem[];
  secondaryAction: ActionLink;
  primaryAction: ActionLink;
};

export default function MobileNav({
  navItems,
  secondaryAction,
  primaryAction,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
        data-testid="mobile-nav-toggle"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="sr-only">{open ? "关闭导航菜单" : "打开导航菜单"}</span>
        <span className="flex flex-col gap-1">
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition ${open ? "opacity-0" : "opacity-100"}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            id="mobile-nav-panel"
            className="absolute inset-x-4 top-20 rounded-[28px] border border-white/60 bg-white/95 p-5 shadow-[0_24px_90px_rgba(20,32,51,0.16)]"
            role="dialog"
            aria-modal="true"
            data-testid="mobile-nav-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-500">快速入口</p>
              <p className="mt-1 text-sm text-slate-600">
                先理解结构，再决定是否进入编辑器或文档。
              </p>
            </div>
            <nav aria-label="移动端主导航" className="flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-5 grid gap-3">
              <a
                href={secondaryAction.href}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                onClick={() => setOpen(false)}
              >
                {secondaryAction.label}
              </a>
              <a
                href={primaryAction.href}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4F86FF_0%,#3CC7B8_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(79,134,255,0.28)] transition hover:brightness-105"
                onClick={() => setOpen(false)}
              >
                {primaryAction.label}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
