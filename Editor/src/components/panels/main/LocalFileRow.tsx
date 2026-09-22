import { FileOutlined } from "@ant-design/icons";
import styles from "../../../styles/panels/LocalFileListPanel.module.less";

interface LocalFileRowProps {
  name: string;
  relativePath: string;
  path: string;
  badge?: string;
  onOpen: () => void;
}

export function LocalFileRow({ name, relativePath, path, badge, onOpen }: LocalFileRowProps) {
  return (
    <button type="button" className={styles.fileItem} title={path} onClick={onOpen}>
      <FileOutlined className={styles.fileIcon} />
      <span className={styles.fileDetails}>
        <span className={styles.fileNameRow}>
          <span className={styles.fileName}>{name}</span>
          {badge && <span className={styles.bundleTag}>{badge}</span>}
        </span>
        <span className={styles.filePath}>{relativePath}</span>
      </span>
    </button>
  );
}
