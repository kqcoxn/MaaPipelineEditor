import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";

import { ProcessIndicator } from "./ProcessIndicator";

type LazyFeatureLoader<Props> = () => Promise<{
  default: ComponentType<Props>;
}>;

const PRODUCTION_MIN_FEATURE_LOADING_MS = 2_000;

export function getMinimumFeatureLoadingMs(
  isDevelopment = import.meta.env.DEV,
): number {
  return isDevelopment ? 0 : PRODUCTION_MIN_FEATURE_LOADING_MS;
}
const lazyComponentCache = new WeakMap<
  LazyFeatureLoader<object>,
  ComponentType<object>
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

function createLazyComponent<Props>(
  loader: LazyFeatureLoader<Props>,
  _attempt: number,
) {
  const cacheKey = loader as LazyFeatureLoader<object>;
  const cached = lazyComponentCache.get(cacheKey);
  if (cached) return cached as ComponentType<Props>;

  const Component = lazy(async () => {
    const startedAt = Date.now();
    try {
      return await loader();
    } finally {
      const remainingMs =
        getMinimumFeatureLoadingMs() - (Date.now() - startedAt);
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }
    }
  });
  lazyComponentCache.set(cacheKey, Component as ComponentType<object>);
  return Component;
}

function FeatureLoadingIndicator({
  label,
  mode,
}: {
  label: string;
  mode: "fullscreen" | "inline";
}) {
  const [stage, setStage] = useState({
    detail: "正在请求功能模块",
    progress: 18,
  });

  useEffect(() => {
    const dependencyTimer = window.setTimeout(
      () => setStage({ detail: "正在加载所需依赖", progress: 44 }),
      520,
    );
    const initializeTimer = window.setTimeout(
      () => setStage({ detail: "正在初始化功能界面", progress: 76 }),
      1_180,
    );
    return () => {
      window.clearTimeout(dependencyTimer);
      window.clearTimeout(initializeTimer);
    };
  }, []);

  return (
    <ProcessIndicator
      label={label}
      detail={stage.detail}
      progress={stage.progress}
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
  const Component = useMemo(
    () => createLazyComponent(loader, attempt),
    [attempt, loader],
  );
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
          detail="功能模块未能完成加载，请检查网络后重试"
          mode={mode}
          error
          onRetry={retry}
        />
      )}
    >
      <Suspense fallback={<FeatureLoadingIndicator label={loadingLabel} mode={mode} />}>
        <Component {...(componentProps ?? ({} as Props))} />
      </Suspense>
    </FeatureErrorBoundary>
  );
}
