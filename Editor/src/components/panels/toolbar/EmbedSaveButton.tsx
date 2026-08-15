import { SaveOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Tooltip } from "antd";
import { memo, useEffect } from "react";
import { requestHostSave } from "../../../features/embed/actions/embedOperations";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { getEmbedHostName, getEmbedLocale } from "../../../utils/embedBridge";
import style from "../../../styles/panels/ToolbarPanel.module.less";

function EmbedSaveButton() {
  const { message } = AntdApp.useApp();
  const isReady = useEmbedStore((state) => state.isReady);
  const host = useEmbedStore((state) => state.host);
  const operation = useEmbedStore((state) => state.saveOperation);
  const reloadPending = useEmbedStore(
    (state) => state.reloadOperation.status === "pending",
  );
  const acknowledgeResult = useEmbedStore(
    (state) => state.acknowledgeSaveResult,
  );
  const hostLabel = getEmbedHostName(host, getEmbedLocale());

  useEffect(() => {
    if (operation.status === "success") {
      message.success(`已保存到 ${hostLabel}`);
      acknowledgeResult();
    } else if (operation.status === "error") {
      message.error(operation.error ?? `保存到 ${hostLabel} 失败`);
      acknowledgeResult();
    }
  }, [
    acknowledgeResult,
    hostLabel,
    message,
    operation.error,
    operation.status,
  ]);

  return (
    <Tooltip title={`将当前 Pipeline 写回 ${hostLabel}`}>
      <Button
        icon={<SaveOutlined />}
        loading={operation.status === "pending"}
        disabled={!isReady || reloadPending}
        onClick={() => requestHostSave()}
        className={style.toolbarButton}
      >
        保存到 {hostLabel}
      </Button>
    </Tooltip>
  );
}

export default memo(EmbedSaveButton);
