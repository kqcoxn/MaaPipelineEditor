import { posix, win32 } from "node:path";

function pathApi(platform) {
  return platform === "win32" ? win32 : posix;
}

export function executableName(platform) {
  return platform === "win32" ? "mpelb.exe" : "mpelb";
}

export function commandName(name, platform) {
  return platform === "win32" ? `${name}.cmd` : name;
}

export function resolveRuntimeDir({ platform, env, homeDir }) {
  const paths = pathApi(platform);
  if (env.MPE_RUNTIME_DIR) {
    return paths.resolve(env.MPE_RUNTIME_DIR);
  }
  if (platform === "win32" && env.LOCALAPPDATA) {
    return paths.join(env.LOCALAPPDATA, "mpelb", "runtime");
  }
  return paths.join(homeDir, ".local", "bin", "runtime");
}

export function wailsCandidates({ platform, env, homeDir }) {
  const paths = pathApi(platform);
  const filename = platform === "win32" ? "wails.exe" : "wails";
  const candidates = [env.MPE_WAILS_BIN];

  if (env.GOBIN) {
    candidates.push(paths.join(env.GOBIN, filename));
  }

  const goPaths = (env.GOPATH ?? "")
    .split(paths.delimiter)
    .filter(Boolean)
    .map((goPath) => paths.join(goPath, "bin", filename));
  candidates.push(...goPaths);
  candidates.push(paths.join(homeDir, "go", "bin", filename));

  if (platform !== "win32") {
    candidates.push(paths.join(homeDir, ".local", "bin", filename));
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function packagedExecutableDir({ platform, buildBinDir, appName }) {
  const paths = pathApi(platform);
  if (platform === "darwin") {
    return paths.join(buildBinDir, `${appName}.app`, "Contents", "MacOS");
  }
  return paths.normalize(buildBinDir);
}
