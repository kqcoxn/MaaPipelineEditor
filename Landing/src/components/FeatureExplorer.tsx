import { useId, useMemo, useState } from "react";

import type { FeatureItem } from "@/content/landing";

// 动画时长常量
const ANIMATION_DURATION = 300;

type FeatureExplorerProps = {
  items: FeatureItem[];
};

// 每个能力项的图片索引状态
type ImageIndexMap = Record<number, number>;

const toneClasses = {
  blue: {
    tab: "data-[active=true]:border-blue-300 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700",
    badge: "bg-blue-50 text-blue-700",
    bar: "from-blue-500 to-cyan-400",
    indicator: "bg-blue-500",
    panel: "bg-blue-50/70",
  },
  mint: {
    tab: "data-[active=true]:border-emerald-300 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
    bar: "from-emerald-500 to-teal-400",
    indicator: "bg-emerald-500",
    panel: "bg-emerald-50/70",
  },
  orange: {
    tab: "data-[active=true]:border-orange-300 data-[active=true]:bg-orange-50 data-[active=true]:text-orange-700",
    badge: "bg-orange-50 text-orange-700",
    bar: "from-orange-500 to-amber-400",
    indicator: "bg-orange-500",
    panel: "bg-orange-50/70",
  },
  rose: {
    tab: "data-[active=true]:border-rose-300 data-[active=true]:bg-rose-50 data-[active=true]:text-rose-700",
    badge: "bg-rose-50 text-rose-700",
    bar: "from-rose-500 to-pink-400",
    indicator: "bg-rose-500",
    panel: "bg-rose-50/70",
  },
} as const;

export default function FeatureExplorer({ items }: FeatureExplorerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [imageIndices, setImageIndices] = useState<ImageIndexMap>({});
  const baseId = useId();

  const activeItem = useMemo(() => items[activeIndex] ?? items[0], [activeIndex, items]);
  const displayItem = useMemo(() => items[displayIndex] ?? items[0], [displayIndex, items]);

  // 获取当前显示项的图片索引
  const currentImageIndex = imageIndices[displayIndex] ?? 0;
  const currentImages = displayItem.demoImages ?? [];
  const currentImage = currentImages[currentImageIndex];

  const handleTabChange = (nextIndex: number) => {
    if (nextIndex === activeIndex || isAnimating) return;

    setIsAnimating(true);
    setActiveIndex(nextIndex);
    setDisplayIndex(nextIndex);

    // 动画结束后重置状态
    setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATION);
  };

  // 切换当前能力项的图片
  const handleImageChange = (imageIndex: number) => {
    if (imageIndex === currentImageIndex) return;

    setImageIndices(prev => ({ ...prev, [displayIndex]: imageIndex }));
  };

  const moveFocus = (nextIndex: number) => {
    handleTabChange(nextIndex);
    const nextButton = document.getElementById(`${baseId}-tab-${nextIndex}`);
    nextButton?.focus();
  };

  return (
    <div className="rounded-[36px] border border-white/70 bg-white/88 p-4 shadow-[0_28px_100px_rgba(20,32,51,0.1)] backdrop-blur sm:p-6">
      <div className="overflow-x-auto pb-3">
        <div
          className="flex justify-center min-w-full gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 p-2"
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
                className={`min-w-fit rounded-full border border-transparent px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-300 ease-out hover:text-slate-950 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${tone.tab}`}
                onClick={() => handleTabChange(index)}
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

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* 左侧：图片为主的内容区 */}
        <div
          id={`${baseId}-panel-${activeIndex}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeIndex}`}
          data-testid="feature-panel"
          className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-inner shadow-slate-900/5"
        >
          {/* 16:9 图片区域 */}
          <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-[0_18px_50px_rgba(20,32,51,0.08)]">
            {/* 图片背景 */}
            <div className={`absolute inset-0 bg-gradient-to-br ${toneClasses[displayItem.tone].bar} opacity-10`} />
            
            {/* 真实图片或占位内容 - 使用固定key让React复用元素实现淡入淡出 */}
            {[0, 1, 2, 3, 4].map((slotIdx) => {
              const imgSrc = currentImages[slotIdx];
              const isActive = slotIdx === currentImageIndex;
              return imgSrc ? (
                <img
                  key={`img-slot-${slotIdx}`}
                  src={imgSrc}
                  alt={displayItem.demoTitle || displayItem.title}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                    isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                />
              ) : null;
            })}
            {currentImages.length === 0 && (displayItem.demoLabel || displayItem.demoTitle) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                <div className="flex gap-2 mb-4">
                  <span className="h-3 w-3 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '0ms' }}></span>
                  <span className="h-3 w-3 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '150ms' }}></span>
                  <span className="h-3 w-3 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '300ms' }}></span>
                </div>
                <div className={`rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur px-6 py-4 text-center shadow-lg transition-all duration-500 ${
                  isAnimating ? 'scale-95 opacity-70' : 'scale-100 opacity-100'
                }`}>
                  {displayItem.demoLabel && (
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {displayItem.demoLabel}
                    </p>
                  )}
                  {displayItem.demoTitle && (
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {displayItem.demoTitle}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            
            {/* 左右切换按钮 - 仅当有多张图片时显示 */}
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={() => handleImageChange((currentImageIndex - 1 + currentImages.length) % currentImages.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur p-2 shadow-lg hover:bg-white transition-colors z-20"
                  aria-label="上一张图片"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleImageChange((currentImageIndex + 1) % currentImages.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur p-2 shadow-lg hover:bg-white transition-colors z-20"
                  aria-label="下一张图片"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* 角落装饰 */}
            <div className="absolute top-3 right-3 z-30">
              <span className={`rounded-full border border-white/80 px-3 py-1 text-[11px] font-semibold ${toneClasses[displayItem.tone].badge} shadow-sm`}>
                Preview
              </span>
            </div>
          </div>

          {/* 图片指示器 */}
          <div className="mt-5 flex justify-center gap-2">
            {currentImages.length > 0 ? (
              currentImages.map((_, imageIdx) => {
                const isActive = imageIdx === currentImageIndex;
                const tone = toneClasses[displayItem.tone];
                return (
                  <button
                    key={imageIdx}
                    onClick={() => handleImageChange(imageIdx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
                      isActive
                        ? `w-8 ${tone.indicator}`
                        : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`切换到第 ${imageIdx + 1} 张图片`}
                  />
                );
              })
            ) : (
              // 无图片时的默认占位指示器
              <div className="h-1.5 w-8 rounded-full bg-slate-200" />
            )}
          </div>
        </div>

        {/* 右侧：文字说明区 */}
        <div 
          className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(20,32,51,0.08)]"
        >
          <div className={`transition-all duration-${ANIMATION_DURATION} ease-out ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${toneClasses[displayItem.tone].bar}`} />
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                能力说明
              </p>
            </div>
            
            <h3 className="mt-3 text-2xl font-semibold text-slate-950 leading-tight">
              {displayItem.title}
            </h3>
            
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {displayItem.description}
            </p>

            {/* 标签 */}
            <div className="mt-5 flex flex-wrap gap-2">
              {displayItem.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClasses[displayItem.tone].badge} hover:scale-105 hover:shadow-sm transition-transform`}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* 指标卡片 */}
            <div className="mt-6 grid gap-3">
              {displayItem.metrics.map((metric) => (
                <div
                  key={metric}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${toneClasses[displayItem.tone].bar}`} />
                    {metric}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
