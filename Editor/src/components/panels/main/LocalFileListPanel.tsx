import { PiFileList } from "@/features/pi-editor/PiFileList";
import { usePiEditorStore } from "@/features/pi-editor/store";
import { createPiFileDialog } from "@/features/pi-editor/dialogs";
import { useWorkspaceStore } from "@/stores/ui/workspaceStore";
import { LocalFileRow } from "./LocalFileRow";
import {
  App as AntdApp,
  Tooltip,
  Button,
  Input,
  Empty,
  Segmented,
  theme,
} from "antd";
import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import {
  PlusOutlined,
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
  const { token } = theme.useToken();
  const view = useWorkspaceStore(s => s.view);
  const project = usePiEditorStore(s => s.project);
  const [fileType, setFileType] = useState<'pipeline' | 'interface'>(view === 'canvas' ? 'pipeline' : 'interface');
  const lastOpenView = useRef<string | undefined>(undefined);
  const wasOpen = useRef(false);
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
  useEffect(() => {
    if (showLocalFilePanel && !wasOpen.current) {
      if (lastOpenView.current !== view) setFileType(view === 'canvas' ? 'pipeline' : 'interface');
      lastOpenView.current = view;
    }
    wasOpen.current = showLocalFilePanel;
  }, [showLocalFilePanel, view]);
  const displayedRoot = fileType === 'pipeline' ? rootPath : project?.entryPath.replace(/[\\/][^\\/]+$/, '') || '';
  const scopedFiles = useMemo(() => filterLocalFilesByFolderFilter(files, folderFilter), [files, folderFilter]);

  // 过滤文件列表
  const filteredFiles = useMemo(() => {
    if (!searchText.trim()) {
      return scopedFiles;
    }
    const searchLower = searchText.trim().toLowerCase();
    return scopedFiles.filter(
      (file) =>
        file.file_name.toLowerCase().includes(searchLower) ||
        file.relative_path.toLowerCase().includes(searchLower) ||
        file.bundle_name.toLowerCase().includes(searchLower),
    );
  }, [scopedFiles, searchText]);

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
    void usePiEditorStore.getState().refresh().catch(() => {});
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
    <div className={panelClass} style={{
      '--files-bg': token.colorBgContainer,
      '--files-text': token.colorText,
      '--files-muted': token.colorTextSecondary,
      '--files-fill': token.colorFillQuaternary,
      '--files-hover': token.colorFillTertiary,
      '--files-border': token.colorBorderSecondary,
      '--files-primary': token.colorPrimary,
    } as CSSProperties}>
      <div className={classNames("header", styles.header)}>
        <div className={styles.title}>
          <FolderOutlined />
          <span className={styles.titleText}>本地文件</span>
          <span style={{ marginLeft: -12, marginTop: 2 }}>
            <WikiAnchor path="20.本地服务/10.本地文件管理.html" title="本地文件管理" description="浏览 Pipeline 与 Interface 项目文件" />
          </span>
        </div>
        <div className={styles.actions}>
          <Tooltip title="刷新文件列表">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              aria-label="刷新文件列表"
              onClick={handleRefresh}
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              aria-label="关闭文件面板"
              onClick={closePanel}
            />
          </Tooltip>
        </div>
      </div>

      <div className={styles.typeSwitch}>
        <Segmented block value={fileType} onChange={value => setFileType(value as typeof fileType)} options={[
          { value: 'pipeline', label: <span className={styles.typeLabel}>Pipeline <span className={styles.count}>{scopedFiles.length}</span></span> },
          { value: 'interface', label: <span className={styles.typeLabel}>Interface <span className={styles.count}>{project?.documents.length ?? 0}</span></span> },
        ]} />
      </div>

      {displayedRoot && (
        <div className={styles.rootPath}>
          <Tooltip title={displayedRoot}>
            <div className={styles.rootPathText}>{displayedRoot}</div>
          </Tooltip>
        </div>
      )}

      <div className={styles.searchBar}>
        <Input
          placeholder={fileType === 'pipeline' ? '搜索 Pipeline 文件…' : '搜索 Interface 文件…'}
          aria-label="搜索文件"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        {fileType === 'interface' && <Tooltip title="新建 PI 文件">
          <Button type="text" icon={<PlusOutlined />} aria-label="新建 PI 文件" disabled={!project} onClick={createPiFileDialog} />
        </Tooltip>}
      </div>

      <div className={styles.fileList}>
        {fileType === 'interface' ? <PiFileList search={searchText} onOpen={closePanel} /> : filteredFiles.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              files.length === 0 ? "暂无文件，点击刷新加载" : "未找到匹配的文件"
            }
          />
        ) : (
          <section aria-label="Pipeline 文件">
            {filteredFiles.map(file => <LocalFileRow key={file.file_path}
              name={file.file_name} relativePath={file.relative_path} path={file.file_path}
              badge={file.bundle_name} onOpen={() => handleOpenFile(file)}
            />)}
          </section>
        )}
      </div>
    </div>
  );
};
