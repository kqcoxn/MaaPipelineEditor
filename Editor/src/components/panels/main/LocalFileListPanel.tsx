import { List } from "../../SimpleList";
import {
  App as AntdApp,
  Tooltip,
  Badge,
  Button,
  Input,
  Empty,
  Tag,
} from "antd";
import { useState, useMemo, useCallback } from "react";
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
} from "@/stores/project/localFileStore";
import { useConfigStore } from "@/stores/app/configStore";
import { useControlledPanelOccupancy } from "../../../hooks/useControlledPanelOccupancy";
import { localServer } from "../../../services/server";
import { filterLocalFilesByFolderFilter } from "../../../utils/file/folderFilter";
import classNames from "classnames";
import { WikiAnchor } from "../../wiki/WikiAnchor";

import styles from "../../../styles/panels/LocalFileListPanel.module.less";

export const LocalFileListPanel: React.FC = () => {
  const { message } = AntdApp.useApp();
  const showLocalFilePanel = useConfigStore(
    (state) => state.status.showLocalFilePanel,
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const closePanel = useCallback(
    () => setStatus("showLocalFilePanel", false),
    [setStatus],
  );
  const panelOpen = useControlledPanelOccupancy(
    "localFile",
    showLocalFilePanel,
    closePanel,
  );
  const rootPath = useLocalFileStore((state) => state.rootPath);
  const files = useLocalFileStore((state) => state.files);
  const folderFilter = useConfigStore(
    (state) => state.configs.crossFileSearchFolderFilter,
  );
  const setRefreshing = useLocalFileStore((state) => state.setRefreshing);
  const [searchText, setSearchText] = useState("");

  // 过滤文件列表
  const filteredFiles = useMemo(() => {
    const folderFilteredFiles = filterLocalFilesByFolderFilter(
      files,
      folderFilter,
    );

    if (!searchText.trim()) {
      return folderFilteredFiles;
    }
    const searchLower = searchText.toLowerCase();
    return folderFilteredFiles.filter(
      (file) =>
        file.file_name.toLowerCase().includes(searchLower) ||
        file.relative_path.toLowerCase().includes(searchLower) ||
        file.bundle_name.toLowerCase().includes(searchLower),
    );
  }, [files, folderFilter, searchText]);

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
    closePanel();
  };

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [styles.panel]: true,
        "panel-show": panelOpen,
      }),
    [panelOpen],
  );

  return (
    <div className={panelClass}>
      <div className={classNames("header", styles.header)}>
        <div className={styles.title}>
          <FolderOutlined />
          <span className={styles.titleText}>本地文件</span>
          <span style={{ marginLeft: -12, marginTop: 2 }}>
            <WikiAnchor path="20.本地服务/10.本地文件管理.html" title="本地文件管理" description="管理资源目录下Pipeline文件" />
          </span>
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
              onClick={closePanel}
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
            split={false}
            dataSource={filteredFiles}
            renderItem={(file) => (
              <List.Item
                className={styles.fileItem}
                onClick={() => handleOpenFile(file)}
              >
                <div className={styles.fileInfo}>
                  <FileOutlined className={styles.fileIcon} />
                  <div className={styles.fileDetails}>
                    <div className={styles.fileNameRow}>
                      <div className={styles.fileName}>{file.file_name}</div>
                      {file.bundle_name && (
                        <Tooltip title={`所属资源：${file.bundle_name}`}>
                          <Tag className={styles.bundleTag} variant="filled">
                            {file.bundle_name}
                          </Tag>
                        </Tooltip>
                      )}
                    </div>
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
