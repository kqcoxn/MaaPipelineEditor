import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ command, mode }) => {
  // 构建产物随 index.html 部署，可同时用于官网子目录和用户自部署目录。
  // 开发服务保留按 mode 区分的访问路径。
  const base =
    command === "build"
      ? "./"
      : mode === "preview"
        ? "/MaaPipelineEditor/"
        : `/${mode}/`;
  return {
    base,
    server: {
      host: "127.0.0.1",
      port: 3000,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "happy-dom",
      setupFiles: ["./tests/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        exclude: [
          "node_modules/",
          "tests/",
          "**/*.d.ts",
          "**/*.config.*",
          "**/mockData",
          "dist",
        ],
      },
    },
  };
});
