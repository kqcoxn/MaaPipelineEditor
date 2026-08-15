import { SyncOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Tooltip } from "antd";
import { memo, useEffect } from "react";
import { requestHostReload } from "../../../features/embed/actions/embedOperations";
import { getEmbedHostName, getEmbedLocale } from "../../../utils/embedBridge";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { flowToPipelineString } from "../../../core/parser";
import style from "../../../styles/panels/ToolbarPanel.module.less";

function EmbedSyncButton() {
  const { message, modal } = AntdApp.useApp();
  const { isEmbed } = useEmbedMode();
  const isReady = useEmbedStore((state) => state.isReady);
  const isDirty = useEmbedStore((state) => state.isDirty);
  const cleanPipeline = useEmbedStore((state) => state.cleanPipeline);
  const host = useEmbedStore((state) => state.host);
  const operation = useEmbedStore((state) => state.reloadOperation);
  const savePending = useEmbedStore(
    (state) => state.saveOperation.status === "pending",
  );
  const acknowledgeResult = useEmbedStore(
    (state) => state.acknowledgeReloadResult,
  );
  const hostLabel = getEmbedHostName(host, getEmbedLocale());

  useEffect(() => {
    if (operation.status === "success") {
      message.success(`已从 ${hostLabel} 同步`);
      acknowledgeResult();
    } else if (operation.status === "error") {
      message.error(operation.error ?? `从 ${hostLabel} 同步失败`);
      acknowledgeResult();
    }
  }, [
    acknowledgeResult,
    hostLabel,
    message,
    operation.error,
    operation.status,
  ]);

  if (!isEmbed) return null;

  const handleSync = () => {
    const hasUnsavedChanges =
      isDirty ||
      (cleanPipeline !== null && flowToPipelineString() !== cleanPipeline);
    if (!hasUnsavedChanges) {
      requestHostReload();
      return;
    }

    modal.confirm({
      title: `从 ${hostLabel} 同步`,
      content: "同步会覆盖 MPE 中尚未保存的修改，是否继续？",
      okText: "继续同步",
      cancelText: "取消",
      onOk: requestHostReload,
    });
  };

  return (
    <Tooltip title={`重新读取 ${hostLabel} 中的当前文档`}>
      <Button
        icon={<SyncOutlined />}
        loading={operation.status === "pending"}
        disabled={!isReady || savePending}
        onClick={handleSync}
        className={style.toolbarButton}
      >
        从 {hostLabel} 同步
      </Button>
    </Tooltip>
  );
}

export default memo(EmbedSyncButton);
