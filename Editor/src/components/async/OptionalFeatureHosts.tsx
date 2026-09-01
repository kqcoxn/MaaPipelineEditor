import { useConfigStore } from "@/stores/app/configStore";
import { useBusinessArchitectureStore } from "@/features/ai-harness/capabilities/business-architecture/store";

import { LazyFeature } from "./LazyFeature";

const loadAIHistoryFeature = () => import("./AIHistoryFeature");
const loadBusinessArchitecturePanel = () =>
  import("@/components/panels/main/BusinessArchitecturePanel");

interface OptionalFeatureHostsProps {
  allowAIHistory: boolean;
  allowBusinessArchitecture: boolean;
}

export function OptionalFeatureHosts({
  allowAIHistory,
  allowBusinessArchitecture,
}: OptionalFeatureHostsProps) {
  const showAIHistory = useConfigStore(
    (state) => state.status.showAIHistoryPanel,
  );
  const activeArchitectureDocument = useBusinessArchitectureStore(
    (state) => state.activeDocumentRunId,
  );

  return (
    <>
      {allowAIHistory && showAIHistory && (
        <LazyFeature
          loader={loadAIHistoryFeature}
          loadingLabel="正在加载 AI 功能包"
        />
      )}
      {allowBusinessArchitecture && activeArchitectureDocument && (
        <LazyFeature
          loader={loadBusinessArchitecturePanel}
          loadingLabel="正在加载流程架构功能包"
        />
      )}
    </>
  );
}

