import { useEmbedStore } from "@/stores/embed/embedStore";
import { getAntdAppApi } from "../../../utils/ui/antdAppApi";

const MPE_QUICK_START_URL =
  "https://mpe.codax.site/docs/guide/start/quick-start.html";

export function showEmbedServiceNotice(featureName: string): void {
  const hostName = useEmbedStore.getState().host?.name ?? "宿主应用";
  getAntdAppApi()?.modal.confirm({
    title: `${featureName}需要独立服务`,
    content: (
      <div>
        <p>当前处于 {hostName} 嵌入模式，请直接使用宿主提供的对应功能。</p>
        <p>如需了解 MPE 的完整功能，可以查看快速开始文档。</p>
      </div>
    ),
    okText: `留在 ${hostName}`,
    cancelText: "查看 MPE 快速开始",
    cancelButtonProps: {
      href: MPE_QUICK_START_URL,
      target: "_blank",
      rel: "noopener noreferrer",
    },
  });
}
