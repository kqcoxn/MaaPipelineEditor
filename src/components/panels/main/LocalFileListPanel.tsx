import { useState, useMemo } from "react";
import { List, Empty, Button, Input, Tooltip, Badge, message } from "antd";
import {
  FileOutlined,
  FolderOutlined,
  ReloadOutlined,
  SearchOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import {
  useLocalFileStore,
  type LocalFileInfo,
} from "../../../stores/localFileStore";
import { useConfigStore } from "../../../stores/configStore";
import { localServer } from "../../../services/server";
import classNames from "classnames";

import styles from "../../../styles/LocalFileListPanel.module.less";

export const LocalFileListPanel: React.FC = () => {
  const showLocalFilePanel = useConfigStore(
    (state) => state.status.showLocalFilePanel
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const rootPath = useLocalFileStore((state) => state.rootPath);
  const files = useLocalFileStore((state) => state.files);
  const setRefreshing = useLocalFileStore((state) => state.setRefreshing);
  const [searchText, setSearchText] = useState("");

  // 过滤文件列表
  const filteredFiles = useMemo(() => {
    if (!searchText.trim()) {
      return files;
    }
    const searchLower = searchText.toLowerCase();
    return files.filter(
      (file) =>
        file.file_name.toLowerCase().includes(searchLower) ||
        file.relative_path.toLowerCase().includes(searchLower)
    );
  }, [files, searchText]);

  // 请求重新加载文件列表
  const handleRefresh = () => {
    if (!localServer.isConnected()) {
      localServer.connect();
      return;
    }

    // 设置刷新状态
    setRefreshing(true);
    message.info("正在刷新文件列表...");

    // 发送请求
    localServer.send("/etl/refresh_file_list", {});
  };

  // 打开文件
  const handleOpenFile = (file: LocalFileInfo) => {
    if (!localServer.isConnected()) {
      message.warning("请先连接本地服务");
      return;
    }

    // 直接发送打开文件请求
    localServer.send("/etl/open_file", {
      file_path: file.file_path,
    });

    // 关闭面板
    setStatus("showLocalFilePanel", false);
  };

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [styles.panel]: true,
        "panel-show": showLocalFilePanel,
      }),
    [showLocalFilePanel]
  );

  return (
    <div className={panelClass}>
      <div className={classNames("header", styles.header)}>
        <div className={styles.title}>
          <FolderOutlined />
          <span className={styles.titleText}>本地文件</span>
          {files.length > 0 && (
            <Badge count={files.length} showZero overflowCount={999} />
          )}
        </div>
        <div className={styles.actions}>
          <Tooltip title="刷新文件列表">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setStatus("showLocalFilePanel", false)}
            />
          </Tooltip>
        </div>
      </div>

      {rootPath && (
        <div className={styles.rootPath}>
          <Tooltip title={rootPath}>
            <div className={styles.rootPathText}>{rootPath}</div>
          </Tooltip>
        </div>
      )}

      <div className={styles.searchBar}>
        <Input
          placeholder="搜索文件..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>

      <div className={styles.fileList}>
        {filteredFiles.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              files.length === 0 ? "暂无文件，点击刷新加载" : "未找到匹配的文件"
            }
          />
        ) : (
          <List
            size="small"
            dataSource={filteredFiles}
            renderItem={(file) => (
              <List.Item
                className={styles.fileItem}
                onClick={() => handleOpenFile(file)}
              >
                <div className={styles.fileInfo}>
                  <FileOutlined className={styles.fileIcon} />
                  <div className={styles.fileDetails}>
                    <div className={styles.fileName}>{file.file_name}</div>
                    <div className={styles.filePath}>{file.relative_path}</div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};
