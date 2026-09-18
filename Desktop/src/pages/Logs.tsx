import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, FolderOpen, RefreshCw, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import "../styles/logs.css";

interface LogFile {
  id: string;
  name: string;
  size: number;
}
interface LogContent {
  content: string;
  truncated: boolean;
  path: string;
}

export function Logs() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selected, setSelected] = useState("");
  const [log, setLog] = useState<LogContent>();
  const [query, setQuery] = useState("");
  const [automatic, setAutomatic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [saved, setSaved] = useState("");
  const generation = useRef(0);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    setLoading(true);
    try {
      const next = await invoke<LogFile[]>("list_logs");
      if (request !== generation.current) return;
      setFiles(next);
      const id = next.some((file) => file.id === selected)
        ? selected
        : (next[0]?.id ?? "");
      setSelected(id);
      const value = id
        ? await invoke<LogContent>("read_log", { id })
        : undefined;
      if (request === generation.current) {
        setLog(value);
        setReadError("");
      }
    } catch (cause) {
      if (request === generation.current) setReadError(String(cause));
    } finally {
      inFlight.current = false;
      if (request === generation.current) setLoading(false);
    }
  }, [selected]);
  useEffect(() => {
    void refresh();
    const timer = automatic
      ? window.setInterval(() => {
          if (!document.hidden) void refresh();
        }, 3000)
      : undefined;
    return () => {
      window.clearInterval(timer);
    };
  }, [refresh, automatic]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );

  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    setError("");
    setSaved("");
    try {
      const path = await invoke<string | null>("export_logs");
      if (path) setSaved(path);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setExporting(false);
    }
  };
  const lines = log?.content.split("\n") ?? [];
  const visible = query.trim()
    ? lines.filter((line) =>
        line.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : lines;
  return (
    <div className="logs-page">
      <header className="page-heading">
        <h1>日志</h1>
        <div className="actions">
          <Button
            variant="secondary"
            onClick={() =>
              void invoke("open_logs_directory").catch((cause) =>
                setError(String(cause)),
              )
            }
          >
            <FolderOpen size={17} />
            打开目录
          </Button>
          <Button
            disabled={exporting || files.length === 0}
            onClick={() => void exportAll()}
          >
            <Download size={17} />
            {exporting ? "正在打包…" : "打包日志"}
          </Button>
        </div>
      </header>
      <p className="logs-description">
        查看启动器、安装过程与托管 LocalBridge
        的输出。打包包含当前及上次会话日志；MFW 详细日志可在编辑器调试面板导出。
      </p>
      <section className="panel logs-panel">
        <div className="logs-toolbar">
          <Select
            value={selected}
            onValueChange={(id) => {
              generation.current++;
              setSelected(id);
              setLog(undefined);
            }}
            disabled={!files.length || loading}
          >
            <SelectTrigger aria-label="选择日志">
              <SelectValue placeholder="暂无日志" />
            </SelectTrigger>
            <SelectContent>
              {files.map((file) => (
                <SelectItem key={file.id} value={file.id}>
                  {file.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="logs-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="搜索当前日志"
              placeholder="搜索当前日志"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="logs-auto">
            <input
              type="checkbox"
              checked={automatic}
              onChange={(event) => setAutomatic(event.target.checked)}
            />
            自动刷新
          </label>
          <Button
            variant="ghost"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} />
            刷新
          </Button>
        </div>
        {(error || readError) && <p role="alert">{error || readError}</p>}
        {saved && (
          <p role="status">
            日志已保存至：<span className="selectable-text">{saved}</span>
          </p>
        )}
        {log && (
          <div className="logs-meta">
            <span className="path">{log.path}</span>
            <span>
              {log.truncated
                ? "仅预览末尾 512 KB，打包保留完整内容"
                : `${Math.ceil((files.find((file) => file.id === selected)?.size ?? 0) / 1024)} KB`}
            </span>
          </div>
        )}
        <pre
          className="logs-viewer selectable-text"
          tabIndex={0}
          aria-label="日志内容"
          aria-busy={loading}
        >
          {visible.join("\n") ||
            (loading
              ? "正在读取日志…"
              : query
                ? "没有匹配的日志，请尝试其他关键词。"
                : "暂无日志内容。")}
        </pre>
      </section>
    </div>
  );
}
