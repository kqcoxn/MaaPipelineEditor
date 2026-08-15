import { Button, Space } from "antd";
import { getAntdAppApi } from "../../../utils/ui/antdAppApi";
import {
  getEmbedHostName,
  getEmbedLocale,
  type EmbedLocale,
} from "../../../utils/embedBridge";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { requestHostReload, requestHostSave } from "../actions/embedOperations";

interface SaveConflictOptions {
  canForce: boolean;
}

export function showEmbedSaveConflict({ canForce }: SaveConflictOptions): void {
  const api = getAntdAppApi();
  if (!api) return;

  const locale: EmbedLocale = getEmbedLocale();
  const hostName = getEmbedHostName(useEmbedStore.getState().host, locale);
  const acknowledgeConflict =
    useEmbedStore.getState().acknowledgeSaveResult;
  const isChinese = locale === "zh-cn";
  const modalInstance = api.modal.confirm({
    title: isChinese ? "宿主数据已发生变化" : "Host data changed",
    content: isChinese
      ? `${hostName} 中的数据已在 MPE 加载后发生变化。同步将使用宿主数据替换当前 MPE 内容；强制覆盖将使用 MPE 当前内容覆盖宿主中的修改。`
      : `The data in ${hostName} changed after it was loaded into MPE. Syncing replaces the current MPE content with the host data. Overwriting replaces the host changes with the current MPE content.`,
    okText: isChinese ? `从 ${hostName} 同步` : `Sync from ${hostName}`,
    cancelText: isChinese ? "取消" : "Cancel",
    onOk: () => {
      acknowledgeConflict();
      requestHostReload();
    },
    onCancel: acknowledgeConflict,
    footer: (_originNode, { OkBtn, CancelBtn }) => (
      <Space>
        <CancelBtn />
        {canForce && (
          <Button
            danger
            onClick={() => {
              modalInstance?.destroy();
              acknowledgeConflict();
              requestHostSave({ hint: "user-confirmed-force", force: true });
            }}
          >
            {isChinese ? "强制覆盖" : "Overwrite"}
          </Button>
        )}
        <OkBtn />
      </Space>
    ),
  });
}
