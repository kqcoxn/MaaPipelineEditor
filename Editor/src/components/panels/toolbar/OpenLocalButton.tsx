import { Button, message } from "antd";
import { FolderOpenOutlined } from "@ant-design/icons";
import { memo, useCallback } from "react";
import { useWSStore } from "@/stores/connection/wsStore";
import { useFileStore } from "@/stores/project/fileStore";
import { fileProtocol } from "@/services/server";
import style from "../../../styles/panels/ToolbarPanel.module.less";

/** 保存当前内容后，使用系统默认程序打开本地文件。 */
function OpenLocalButton() {
  const connected = useWSStore((state) => state.connected);
  const currentFilePath = useFileStore(
    (state) => state.currentFile.config.filePath,
  );
  const saveFileToLocal = useFileStore((state) => state.saveFileToLocal);

  const handleOpen = useCallback(async () => {
    if (!currentFilePath) {
      message.info("当前文件尚未关联本地路径");
      return;
    }
    if (!(await saveFileToLocal())) {
      message.error("文件保存失败，未在本地打开");
      return;
    }
    if (!fileProtocol.requestOpenExternalFile(currentFilePath)) {
      message.error("发送本地打开请求失败");
    }
  }, [currentFilePath, saveFileToLocal]);

  if (!connected) return null;

  return (
    <Button
      icon={<FolderOpenOutlined />}
      onClick={handleOpen}
      disabled={!currentFilePath}
      title={currentFilePath ? "在本地打开当前文件" : "当前文件尚未关联本地路径"}
      className={style.toolbarButton}
    >
      在本地打开
    </Button>
  );
}

export default memo(OpenLocalButton);
