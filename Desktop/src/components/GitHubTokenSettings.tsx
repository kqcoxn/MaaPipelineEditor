import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { openLink, type useLauncher } from "../model";

export function GitHubTokenSettings({
  model: m,
}: {
  model: ReturnType<typeof useLauncher>;
}) {
  const [configured, setConfigured] = useState<boolean>();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void invoke<boolean>("github_token_status")
      .then((value) => {
        if (!disposed) setConfigured(value);
      })
      .catch((error) => {
        if (!disposed) setError(String(error));
      });
    return () => {
      disposed = true;
    };
  }, []);
  const save = (value: string) =>
    m.run(async () => {
      await invoke("save_github_token", { token: value });
      setConfigured(Boolean(value.trim()));
      setToken("");
      setError("");
      m.setNotice(
        value.trim() ? "GitHub Token 已保存" : "GitHub Token 已清除",
        "success",
        "token",
      );
    }, "token");
  return (
    <section className="panel token-settings">
      <div className="token-description">
        <h2>GitHub Token</h2>
        <p>
          可选配置。查询版本时优先使用 Token，失败后使用静态索引或最近有效缓存。
        </p>
      </div>
      <div className="token-field">
        <label htmlFor="github-token">
          {configured === undefined
            ? "尚未读取配置状态"
            : configured
              ? "已配置 · 输入新 Token 可替换"
              : "未配置"}
        </label>
        <input
          id="github-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          maxLength={1024}
          placeholder="粘贴 GitHub Token"
          disabled={m.busy}
          aria-describedby="github-token-storage"
          onChange={(e) => setToken(e.target.value)}
        />
        <p id="github-token-storage" className="hint">
          保存在系统凭据库，仅用于 GitHub 版本查询；保存后不回显。
        </p>
        {error && (
          <p className="problem" role="status">
            {error}
          </p>
        )}
      </div>
      <div className="actions">
        <Button
          disabled={m.busy || !token.trim()}
          onClick={() => void save(token)}
        >
          保存 Token
        </Button>
        <Button
          variant="secondary"
          disabled={m.busy || configured === false}
          onClick={() => void save("")}
        >
          清除 Token
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            void openLink("https://github.com/settings/personal-access-tokens")
          }
        >
          创建 Token
        </Button>
      </div>
    </section>
  );
}
