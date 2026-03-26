const { createServer } = require("http");
const { readFile } = require("fs/promises");
const { existsSync, statSync } = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(process.cwd(), "dist");
const host = "127.0.0.1";
const port = 4321;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error("dist directory is missing. Run `yarn build` before `yarn test`.");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }

    const filePath = path.resolve(path.join(root, pathname));
    const normalizedRoot = path.resolve(root);

    if (!filePath.startsWith(normalizedRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const data = await readFile(filePath);
    const extension = path.extname(filePath);

    res.setHeader("Content-Type", mimeTypes[extension] || "application/octet-stream");
    res.end(data);
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
});

server.listen(port, host, () => {
  const command = process.platform === "win32" ? "yarn.cmd playwright test" : "yarn playwright test";
  const child = spawn(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    server.close(() => {
      process.exit(code ?? 1);
    });
  });
});
