import { useId, useMemo, useState } from "react";

import type { FeatureItem } from "@/content/landing";

type FeatureExplorerProps = {
  items: FeatureItem[];
};

const toneClasses = {
  blue: {
    tab: "data-[active=true]:border-blue-300 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700",
    badge: "bg-blue-50 text-blue-700",
    bar: "from-blue-500 to-cyan-400",
    panel: "bg-blue-50/70",
  },
  mint: {
    tab: "data-[active=true]:border-emerald-300 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
    bar: "from-emerald-500 to-teal-400",
    panel: "bg-emerald-50/70",
  },
  orange: {
    tab: "data-[active=true]:border-orange-300 data-[active=true]:bg-orange-50 data-[active=true]:text-orange-700",
    badge: "bg-orange-50 text-orange-700",
    bar: "from-orange-500 to-amber-400",
    panel: "bg-orange-50/70",
  },
  rose: {
    tab: "data-[active=true]:border-rose-300 data-[active=true]:bg-rose-50 data-[active=true]:text-rose-700",
    badge: "bg-rose-50 text-rose-700",
    bar: "from-rose-500 to-pink-400",
    panel: "bg-rose-50/70",
  },
} as const;

export default function FeatureExplorer({ items }: FeatureExplorerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();

  const activeItem = useMemo(() => items[activeIndex] ?? items[0], [activeIndex, items]);

  const moveFocus = (nextIndex: number) => {
    setActiveIndex(nextIndex);
    const nextButton = document.getElementById(`${baseId}-tab-${nextIndex}`);
    nextButton?.focus();
  };

  return (
    <div className="rounded-[36px] border border-white/70 bg-white/88 p-4 shadow-[0_28px_100px_rgba(20,32,51,0.1)] backdrop-blur sm:p-6">
      <div className="overflow-x-auto pb-3">
        <div
          className="inline-flex min-w-full gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 p-2"
          role="tablist"
          aria-label="MPE 能力展示"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const tone = toneClasses[item.tone];

            return (
              <button
                key={item.id}
                id={`${baseId}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${index}`}
                tabIndex={isActive ? 0 : -1}
                data-active={isActive}
                data-testid={`feature-tab-${item.id}`}
                className={`min-w-fit rounded-full border border-transparent px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${tone.tab}`}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    moveFocus((index + 1) % items.length);
                  }

                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    moveFocus((index - 1 + items.length) % items.length);
                  }

                  if (event.key === "Home") {
                    event.preventDefault();
                    moveFocus(0);
                  }

                  if (event.key === "End") {
                    event.preventDefault();
                    moveFocus(items.length - 1);
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <div
          id={`${baseId}-panel-${activeIndex}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeIndex}`}
          data-testid="feature-panel"
          className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-inner shadow-slate-900/5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {activeItem.demoLabel}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                {activeItem.demoTitle}
              </h3>
            </div>
            <div
              className={`rounded-full border border-white/80 px-3 py-1 text-xs font-semibold ${toneClasses[activeItem.tone].badge}`}
            >
              占位 Demo
            </div>
          </div>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            {activeItem.demoDescription}
          </p>

          <div className="mt-5 rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_18px_50px_rgba(20,32,51,0.08)]">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-slate-100"></span>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                Placeholder Scene
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {activeItem.demoSteps.map((step, index) => (
                <div
                  key={step}
                  className={`rounded-2xl border border-slate-200 px-4 py-3 ${toneClasses[activeItem.tone].panel}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Step {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{step}</p>
                    </div>
                    <div className="h-2 w-20 rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full bg-linear-to-r ${toneClasses[activeItem.tone].bar}`}
                        style={{ width: `${68 + index * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {activeItem.metrics.map((metric) => (
                <div
                  key={metric}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-600"
                >
                  {metric}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(20,32,51,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            能力说明
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{activeItem.title}</h3>
          <p className="mt-4 text-sm leading-7 text-slate-600">{activeItem.description}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {activeItem.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[activeItem.tone].badge}`}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              页面说明
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <li>首版先把结构、信息密度和交互节奏做对，再替换真实素材。</li>
              <li>Demo 面板刻意采用工程感占位视觉，避免首页滑向通用 SaaS 模版。</li>
              <li>后续只需要替换图像资产与少量文案，不需要推翻组件结构。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
