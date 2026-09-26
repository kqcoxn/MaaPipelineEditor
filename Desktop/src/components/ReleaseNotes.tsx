import { lazy, Suspense, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, X } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { loadReleaseNotes, noteVersions } from "../lib/releaseNotes";
import { openLink } from "../model";
import "../styles/release-notes.css";
const Markdown = lazy(() => import("react-markdown"));

export function ReleaseNotes({
  available,
  installed,
}: {
  available: string[];
  installed?: string;
}) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [content, setContent] = useState({ version: "", body: "", error: "" });
  const [retry, setRetry] = useState(0);
  const versions = noteVersions(available, installed);
  useEffect(() => {
    if (!open || !version) return;
    let disposed = false;
    setContent({ version: "", body: "", error: "" });
    loadReleaseNotes(version).then(
      (body) => {
        if (!disposed) setContent({ version, body, error: "" });
      },
      (error) => {
        if (!disposed) setContent({ version, body: "", error: String(error) });
      },
    );
    return () => {
      disposed = true;
    };
  }, [open, version, retry]);
  const link = (url: string) => {
    void openLink(url).catch((error) =>
      setContent((current) => ({ ...current, error: String(error) })),
    );
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setVersion(versions[0] || "");
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary">
          <BookOpen size={16} />
          更新日志
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal container={document.querySelector(".app")}>
        <Dialog.Overlay className="release-notes-overlay" />
        <Dialog.Content className="release-notes-dialog">
          <div className="release-notes-heading">
            <div>
              <Dialog.Title>更新日志</Dialog.Title>
              <Dialog.Description>
                查看各版本的新功能、优化与修复。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="关闭更新日志">
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>
          <div className="release-notes-toolbar">
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger aria-label="更新日志版本">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {versions.map((item) => (
                    <SelectItem key={item} value={item}>
                      MPE {item}
                      {item === installed ? " · 已安装" : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              onClick={() =>
                link(
                  `https://github.com/kqcoxn/MaaPipelineEditor/releases/tag/v${encodeURIComponent(version)}`,
                )
              }
            >
              发布页面
            </Button>
          </div>
          <div
            className="release-notes-body selectable-text"
            aria-busy={content.version !== version}
          >
            {content.version !== version ? (
              <p role="status">正在读取更新日志…</p>
            ) : (
              <>
                {content.error && (
                  <div role="alert">
                    <p>{content.error}</p>
                    <Button
                      variant="secondary"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      重试
                    </Button>
                  </div>
                )}
                <Suspense fallback={<p role="status">正在准备日志内容…</p>}>
                  <Markdown
                    skipHtml
                    components={{
                      a: ({ href, children }) =>
                        href && /^https?:\/\//i.test(href) ? (
                          <a
                            href={href}
                            onClick={(event) => {
                              event.preventDefault();
                              link(href);
                            }}
                          >
                            {children}
                          </a>
                        ) : (
                          <span>{children}</span>
                        ),
                      img: ({ alt }) => <span>{alt}</span>,
                    }}
                  >
                    {content.body}
                  </Markdown>
                </Suspense>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
