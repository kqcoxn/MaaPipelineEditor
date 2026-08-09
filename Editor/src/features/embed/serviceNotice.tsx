import { useEmbedStore } from "../../stores/embedStore";
import { getAntdAppApi } from "../../utils/ui/antdAppApi";

const STANDALONE_MPE_URL = "https://mpe.codax.site/stable/";

export function showEmbedServiceNotice(featureName: string): void {
  const hostName = useEmbedStore.getState().host?.name ?? "宿主应用";
  getAntdAppApi()?.modal.confirm({
    title: `${featureName}需要独立服务`,
    content: (
      <div>
        <p>当前处于 {hostName} 嵌入模式，请直接使用宿主提供的对应功能。</p>
        <p>也可以打开完整 MPE，并连接 LocalBridge 后使用此功能。</p>
      </div>
    ),
    okText: "打开完整 MPE",
    cancelText: `留在 ${hostName}`,
    onOk: () => {
      window.open(STANDALONE_MPE_URL, "_blank", "noopener,noreferrer");
    },
  });
}
