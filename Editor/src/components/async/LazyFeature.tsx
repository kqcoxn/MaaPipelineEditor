import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";

import { ProcessIndicator } from "./ProcessIndicator";

type LazyFeatureLoader<Props> = () => Promise<{
  default: ComponentType<Props>;
}>;

const FEATURE_LOADING_DELAY_MS = 250;
const PRODUCTION_MIN_FEATURE_LOADING_MS = 2_000;

interface LazyFeatureEntry<Props> {
  Component: ComponentType<Props>;
  markIndicatorVisible: () => void;
}
const lazyComponentCache = new WeakMap<
  LazyFeatureLoader<object>,
  LazyFeatureEntry<object>
>();

interface LazyFeatureProps<Props extends object> {
  loader: LazyFeatureLoader<Props>;
  loadingLabel: string;
  componentProps?: Props;
  mode?: "fullscreen" | "inline";
}

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  onError: () => void;
  onRetry: () => void;
}

interface FeatureErrorBoundaryState {
  failed: boolean;
}

function createLazyComponent<Props>(loader: LazyFeatureLoader<Props>) {
  const cacheKey = loader as LazyFeatureLoader<object>;
  const cached = lazyComponentCache.get(cacheKey);
  if (cached) return cached as LazyFeatureEntry<Props>;

  let indicatorVisibleUntil = 0;
  const Component = lazy(async () => {
    try {
      return await loader();
    } finally {
      // 仅在提示已实际显示时保留防闪烁时长，快速加载不额外等待。
      // 多处同时使用同一模块时，后出现的提示也要完整展示。
      while (indicatorVisibleUntil > Date.now()) {
        await new Promise((resolve) =>
          setTimeout(resolve, indicatorVisibleUntil - Date.now()),
        );
      }
    }
  });
  const entry: LazyFeatureEntry<Props> = {
    Component: Component as ComponentType<Props>,
    markIndicatorVisible: () => {
      if (!import.meta.env.DEV) {
        indicatorVisibleUntil = Date.now() + PRODUCTION_MIN_FEATURE_LOADING_MS;
      }
    },
  };
  lazyComponentCache.set(cacheKey, entry as LazyFeatureEntry<object>);
  return entry;
}

function FeatureLoadingIndicator({
  label,
  mode,
  onVisible,
}: {
  label: string;
  mode: "fullscreen" | "inline";
  onVisible: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisible(true),
      FEATURE_LOADING_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    if (visible) onVisible();
  }, [visible, onVisible]);

  if (!visible) return null;

  return (
    <ProcessIndicator
      label={label}
      detail="正在加载…"
      mode={mode}
    />
  );
}

class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  state: FeatureErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): FeatureErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LazyFeature] Failed to load feature:", error, info);
    this.props.onError();
  }

  private retry = () => {
    this.setState({ failed: false });
    this.props.onRetry();
  };

  render() {
    return this.state.failed
      ? this.props.fallback(this.retry)
      : this.props.children;
  }
}

export function LazyFeature<Props extends object>({
  loader,
  loadingLabel,
  componentProps,
  mode = "fullscreen",
}: LazyFeatureProps<Props>) {
  const [attempt, setAttempt] = useState(0);
  const { Component, markIndicatorVisible } = createLazyComponent(loader);
  const resetLoader = () => {
    lazyComponentCache.delete(loader as LazyFeatureLoader<object>);
  };

  return (
    <FeatureErrorBoundary
      key={attempt}
      onError={resetLoader}
      onRetry={() => {
        resetLoader();
        setAttempt((current) => current + 1);
      }}
      fallback={(retry) => (
        <ProcessIndicator
          label={`${loadingLabel}失败`}
          detail="功能模块未能完成加载，请重试；若持续失败，请重新打开编辑器"
          mode={mode}
          error
          onRetry={retry}
        />
      )}
    >
      <Suspense
        fallback={
          <FeatureLoadingIndicator
            label={loadingLabel}
            mode={mode}
            onVisible={markIndicatorVisible}
          />
        }
      >
        <Component {...(componentProps ?? ({} as Props))} />
      </Suspense>
    </FeatureErrorBoundary>
  );
}
