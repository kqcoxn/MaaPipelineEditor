import { existsSync, readFileSync, lstatSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function normalizeVersion(value) {
  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value ?? "")) {
    throw new Error(`无效的 MaaFramework 版本: ${value}`);
  }
  return `v${value.replace(/^v/, "")}`;
}

export function platformAsset(platform = process.platform, arch = process.arch) {
  const system = { darwin: "macos", linux: "linux", win32: "win" }[platform];
  const cpu = { x64: "x86_64", arm64: "aarch64" }[arch];
  if (!system || !cpu) throw new Error(`不支持的平台: ${platform}/${arch}`);
  const library = { darwin: "libMaaFramework.dylib", linux: "libMaaFramework.so", win32: "MaaFramework.dll" }[platform];
  return { prefix: `MAA-${system}-${cpu}-`, library };
}

export function userConfigPath(platform = process.platform, home = os.homedir(), env = process.env) {
  const base = platform === "darwin"
    ? path.join(home, "Library", "Application Support")
    : platform === "win32"
      ? env.APPDATA || path.join(home, "AppData", "Roaming")
      : env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(base, "MaaPipelineEditor", "LocalBridge", "config", "config.json");
}

export function createPlan(repositoryRoot, options = {}, userConfig = userConfigPath()) {
  const cwd = path.resolve(options.cwd || path.join(repositoryRoot, "LocalBridge"));
  const binaryDir = path.resolve(options["binary-dir"] || path.join(repositoryRoot, "LocalBridge", "build"));
  const configDir = path.join(binaryDir, "config");
  const configPath = options.config ? path.resolve(options.config)
    : existsSync(configDir)
      ? path.join(configDir, existsSync(path.join(configDir, "default.json")) ? "default.json" : "config.json")
      : userConfig;
  if (options.config && !existsSync(configPath)) throw new Error(`配置文件不存在: ${configPath}`);
  if (existsSync(configPath) && path.extname(configPath).toLowerCase() !== ".json") {
    throw new Error("自动解析仅支持 JSON 配置；请通过 --lib-dir 显式指定目标，并省略 --config。");
  }
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")) : {};
  const rawLibDir = config.maafw?.lib_dir;
  if (rawLibDir != null && typeof rawLibDir !== "string") throw new Error("maafw.lib_dir 必须是字符串");
  const configuredDir = rawLibDir?.trim() ? path.resolve(cwd, rawLibDir.trim()) : null;
  const bundledDir = path.join(binaryDir, "runtime", "maafw", "bin");
  // 对齐 Config.ResolvedMaaFWLibDir：有效配置优先，其次附带目录，最后保留尚不存在的配置路径。
  const libDir = options["lib-dir"] ? path.resolve(options["lib-dir"])
    : configuredDir && existsSync(configuredDir) ? configuredDir
      : existsSync(bundledDir) ? bundledDir : configuredDir || bundledDir;
  if (path.basename(libDir).toLowerCase() !== "bin") {
    throw new Error(`目标必须是 MaaFramework 发行包专用的 bin 目录，避免替换混合用途目录: ${libDir}`);
  }
  if (existsSync(libDir) && !lstatSync(libDir).isDirectory()) {
    throw new Error(`目标必须是实际目录，不能是文件或符号链接: ${libDir}`);
  }
  const source = readFileSync(path.join(repositoryRoot, "Editor/src/stores/app/configStore.ts"), "utf8");
  const requiredVersion = normalizeVersion(source.match(/^\s*mfwVersion:\s*"([^"]+)"/m)?.[1]);
  const version = options.version ? normalizeVersion(options.version) : requiredVersion;
  const root = path.dirname(libDir);
  const marker = path.join(root, ".version");
  const asset = platformAsset();
  if (existsSync(libDir) && readdirSync(libDir).length
      && !existsSync(path.join(libDir, asset.library)) && !existsSync(marker)) {
    throw new Error(`非空目标缺少 MaaFramework 主库与版本标记，无法确认是运行时专用目录: ${libDir}`);
  }
  return {
    version, requiredVersion, configPath, cwd, binaryDir, libDir, root,
    agentDir: path.join(root, "share", "MaaAgentBinary"),
    installedVersion: existsSync(marker) ? readFileSync(marker, "utf8").trim() : "未知",
    ...asset,
  };
}
