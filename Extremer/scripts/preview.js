/**
 * MaaPipelineExtremer 预览构建脚本
 * 自动构建完整的 Windows amd64 包并运行
 */

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function logStep(step, total, msg) {
  log(`[${step}/${total}] ${msg}`, colors.blue);
}

function logInfo(msg) {
  log(`✓ ${msg}`, colors.green);
}

function logError(msg) {
  log(`✗ ${msg}`, colors.red);
}

function logWarn(msg) {
  log(`⚠ ${msg}`, colors.yellow);
}

// 路径配置
const scriptDir = __dirname;
const extremerDir = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(extremerDir, "..");
const buildDir = path.join(extremerDir, "build");
const packageDir = path.join(buildDir, "package");

// 步骤总数
const TOTAL_STEPS = 6;

try {
  log("\n============================================", colors.blue);
  log("MaaPipelineExtremer 预览构建", colors.blue);
  log("============================================\n", colors.blue);

  // 步骤 1: 清理构建目录
  logStep(1, TOTAL_STEPS, "清理构建目录...");
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(path.join(buildDir, "web"), { recursive: true });
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(path.join(packageDir, "bin"), { recursive: true });
  fs.mkdirSync(path.join(packageDir, "config"), { recursive: true });
  fs.mkdirSync(path.join(packageDir, "logs"), { recursive: true });
  fs.mkdirSync(path.join(packageDir, "web"), { recursive: true });
  logInfo("构建目录准备完成");

  // 步骤 2: 构建前端
  logStep(2, TOTAL_STEPS, "构建前端...");
  process.chdir(projectRoot);
  execSync("yarn build --mode extremer", { stdio: "inherit" });

  // 复制前端产物
  const distDir = path.join(projectRoot, "dist");
  const webDir = path.join(buildDir, "web");
  if (fs.existsSync(distDir)) {
    copyDir(distDir, webDir);
    logInfo("前端构建完成");
  } else {
    logError("前端构建产物不存在");
    process.exit(1);
  }

  // 步骤 3: 构建 LocalBridge
  logStep(3, TOTAL_STEPS, "构建 LocalBridge...");
  const lbDir = path.join(projectRoot, "LocalBridge");
  process.chdir(lbDir);

  const lbExe = path.join(packageDir, "bin", "localbridge.exe");
  execSync(`go build -o "${lbExe}" ./cmd/lb`, {
    stdio: "inherit",
    env: { ...process.env, GOOS: "windows", GOARCH: "amd64" },
  });
  logInfo("LocalBridge 构建完成");

  // 步骤 4: 准备 Wails 前端资源
  logStep(4, TOTAL_STEPS, "准备 Wails 前端资源...");
  const frontendDistDir = path.join(extremerDir, "frontend", "dist");

  // 清理旧的前端资源
  if (fs.existsSync(frontendDistDir)) {
    fs.rmSync(frontendDistDir, { recursive: true, force: true });
  }
  fs.mkdirSync(frontendDistDir, { recursive: true });

  // 复制前端资源
  log(`  复制: ${webDir} -> ${frontendDistDir}`, colors.blue);
  if (!fs.existsSync(webDir)) {
    logError(`前端构建产物不存在: ${webDir}`);
    process.exit(1);
  }

  copyDir(webDir, frontendDistDir);

  // 验证复制结果
  const indexHtml = path.join(frontendDistDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    logError(`前端 index.html 不存在: ${indexHtml}`);
    process.exit(1);
  }

  logInfo("前端资源准备完成");

  // 步骤 5: 构建 Wails 应用
  logStep(5, TOTAL_STEPS, "构建 Wails 应用...");
  process.chdir(extremerDir);
  execSync("wails build -clean -platform windows/amd64", { stdio: "inherit" });

  // 查找 Wails 构建产物
  const wailsBuildDir = path.join(extremerDir, "build", "bin");
  let exePath = null;
  if (fs.existsSync(wailsBuildDir)) {
    const files = fs.readdirSync(wailsBuildDir);
    const exeFile = files.find((f) => f.endsWith(".exe"));
    if (exeFile) {
      exePath = path.join(wailsBuildDir, exeFile);
    }
  }

  if (!exePath || !fs.existsSync(exePath)) {
    logError("Wails 构建产物不存在");
    process.exit(1);
  }
  logInfo("Wails 应用构建完成");

  // 步骤 6: 组装完整包
  logStep(6, TOTAL_STEPS, "组装完整包...");

  // 复制主程序到 package 根目录
  const targetExe = path.join(packageDir, "MaaPipelineExtremer.exe");
  fs.copyFileSync(exePath, targetExe);

  // 复制 LocalBridge 可执行文件（已在步骤3构建到 package/bin）
  // 无需额外操作

  // 复制配置模板
  const configTemplateDir = path.join(extremerDir, "assets", "config");
  fs.copyFileSync(
    path.join(configTemplateDir, "extremer.json.template"),
    path.join(packageDir, "config", "extremer.json")
  );
  fs.copyFileSync(
    path.join(configTemplateDir, "localbridge.json.template"),
    path.join(packageDir, "config", "localbridge.json")
  );

  // 创建 logs 目录（如果不存在）
  const logsDir = path.join(packageDir, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 复制 resource 目录（包含 mfw 和 ocr）
  const resourceSrcDir = path.join(extremerDir, "resource");
  const resourceDestDir = path.join(packageDir, "resource");

  if (fs.existsSync(resourceSrcDir)) {
    log("  复制资源目录...", colors.blue);
    copyDir(resourceSrcDir, resourceDestDir);
    logInfo("资源目录复制完成");
  } else {
    log("  资源目录不存在，跳过", colors.yellow);
  }

  logInfo("完整包组装完成");

  log("\n============================================", colors.green);
  log("✓ 构建完成！", colors.green);
  log(`输出位置: ${packageDir}`, colors.green);
  log("============================================\n", colors.green);

  // 启动应用
  log("正在启动应用...", colors.blue);
  const child = spawn(targetExe, [], {
    cwd: packageDir,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  logInfo("应用已启动");
} catch (error) {
  logError(`构建失败: ${error.message}`);
  process.exit(1);
}

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
