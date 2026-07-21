import {
  FileOutlined,
  FolderOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { App, Input, type InputRef } from "antd";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import style from "../../styles/layout/ProjectSidebar.module.less";
import { activateEditorTab } from "../../services/projectSessionActions";
import { fileProtocol } from "../../services/server";
import { useDocumentStore } from "../../stores/documentStore";

const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*]/;

type TreeEntry = { path: string; kind: "directory" | "file" };

export interface CreateFileTarget {
  key: string;
  label: string;
  path: string;
}

export interface RenameEntryTarget {
  label: string;
  path: string;
  directoryPath: string;
  kind: "directory" | "file";
}

function normalizeProjectPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function validateEntryName(
  entryName: string,
  directoryPath: string,
  entries: ReadonlyArray<TreeEntry>,
  ignoredPath?: string,
  nameLabel = "文件名",
): string | null {
  const name = entryName.trim();
  if (!name) return `请输入${nameLabel}`;
  if (
    name === "." ||
    name === ".." ||
    INVALID_FILE_NAME_PATTERN.test(name) ||
    [...name].some((character) => character.charCodeAt(0) < 32)
  ) {
    return `${nameLabel}不能包含路径分隔符或系统保留字符`;
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    return `${nameLabel}不能以句点或空格结尾`;
  }

  const targetPath = normalizeProjectPath(
    directoryPath ? `${directoryPath}/${name}` : name,
  ).toLocaleLowerCase();
  const ignored = normalizeProjectPath(ignoredPath ?? "").toLocaleLowerCase();
  const duplicated = entries.some((entry) => {
    const entryPath = normalizeProjectPath(entry.path).toLocaleLowerCase();
    return entryPath !== ignored && entryPath === targetPath;
  });
  return duplicated ? "该文件夹中已存在同名文件或文件夹" : null;
}

export function getDirectoryPath(path: string): string {
  const segments = normalizeProjectPath(path).split("/");
  return segments.slice(0, -1).join("/");
}

export function CreateFileTreeInput({
  target,
  entries,
  onFinish,
}: {
  target: CreateFileTarget;
  entries: ReadonlyArray<TreeEntry>;
  onFinish: () => void;
}) {
  const { message } = App.useApp();
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  const submit = useCallback(async () => {
    if (creatingRef.current) return;
    const trimmedName = fileName.trim();
    if (!trimmedName) {
      onFinish();
      return;
    }

    const validationError = validateEntryName(trimmedName, target.path, entries);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus({ cursor: "all" });
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const createdPath = await fileProtocol.requestCreateFile(
        trimmedName,
        target.path,
      );
      if (!createdPath) {
        setError("文件创建失败");
        return;
      }
      onFinish();
      const descriptor = useDocumentStore.getState().documents[createdPath];
      let opened: boolean;
      if (descriptor?.kind === "pipeline") {
        opened = await activateEditorTab({
          kind: "pipeline",
          path: createdPath,
          key: `pipeline:${createdPath}`,
        });
      } else if (descriptor) {
        opened = await activateEditorTab({
          kind: "document",
          path: createdPath,
          key: `document:${createdPath}`,
        });
      } else {
        opened = fileProtocol.requestOpenFile(createdPath);
      }
      if (!opened) message.error("文件已创建，但自动打开失败");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "文件创建失败",
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [entries, fileName, message, onFinish, target.path]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (creatingRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onFinish();
      } else if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    },
    [onFinish, submit],
  );

  return (
    <FileNameInput
      inputRef={inputRef}
      value={fileName}
      error={error}
      loading={creating}
      kind="file"
      placeholder="文件名"
      ariaLabel={`在 ${target.label} 中新建文件`}
      onChange={(value) => {
        setFileName(value);
        if (error) setError(null);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => void submit()}
    />
  );
}

export function RenameTreeEntryInput({
  target,
  entries,
  onFinish,
}: {
  target: RenameEntryTarget;
  entries: ReadonlyArray<TreeEntry>;
  onFinish: () => void;
}) {
  const { message } = App.useApp();
  const [fileName, setFileName] = useState(target.label);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const renamingRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  const submit = useCallback(async () => {
    if (renamingRef.current || cancelledRef.current) return;
    const trimmedName = fileName.trim();
    if (!trimmedName || trimmedName === target.label) {
      onFinish();
      return;
    }

    const entryLabel = target.kind === "directory" ? "文件夹" : "文件";
    const validationError = validateEntryName(
      trimmedName,
      target.directoryPath,
      entries,
      target.path,
      target.kind === "directory" ? "文件夹名称" : "文件名",
    );
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus({ cursor: "all" });
      return;
    }

    renamingRef.current = true;
    setRenaming(true);
    setError(null);
    try {
      const renamedPath = await fileProtocol.requestRenameEntry(
        target.path,
        trimmedName,
      );
      if (!renamedPath) {
        setError(`${entryLabel}重命名失败`);
        return;
      }
      onFinish();
      message.success(`${entryLabel}已重命名为 ${trimmedName}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `${entryLabel}重命名失败`,
      );
    } finally {
      renamingRef.current = false;
      setRenaming(false);
    }
  }, [entries, fileName, message, onFinish, target]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (renamingRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cancelledRef.current = true;
        onFinish();
      } else if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    },
    [onFinish, submit],
  );

  return (
    <FileNameInput
      inputRef={inputRef}
      value={fileName}
      error={error}
      loading={renaming}
      kind={target.kind}
      ariaLabel={`重命名 ${target.label}`}
      onChange={(value) => {
        setFileName(value);
        if (error) setError(null);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => void submit()}
    />
  );
}

function FileNameInput({
  inputRef,
  value,
  error,
  loading,
  kind,
  placeholder,
  ariaLabel,
  onChange,
  onKeyDown,
  onBlur,
}: {
  inputRef: React.RefObject<InputRef | null>;
  value: string;
  error: string | null;
  loading: boolean;
  kind: "directory" | "file";
  placeholder?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}) {
  return (
    <span
      className={`${style.treeTitle} ${style.createFileRow}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {kind === "directory" ? (
        <FolderOutlined className={style.treeNodeIcon} />
      ) : (
        <FileOutlined className={style.treeNodeIcon} />
      )}
      <Input
        ref={inputRef}
        className={style.createFileInput}
        size="small"
        value={value}
        status={error ? "error" : undefined}
        disabled={loading}
        suffix={
          <LoadingOutlined
            aria-hidden="true"
            className={
              loading ? style.createFileLoadingActive : style.createFileLoading
            }
          />
        }
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={Boolean(error)}
        title={error ?? undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
    </span>
  );
}
