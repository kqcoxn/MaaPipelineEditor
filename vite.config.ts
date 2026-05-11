import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  let base = "/stable/";
  if (mode === "preview") {
    base = "/MaaPipelineEditor/";
  } else if (mode === "extremer") {
    base = "./";
  } else if (mode !== "stable") {
    base = `/${mode}/`;
  }
  return {
    base,
    server: {
      host: "127.0.0.1",
      port: 3000,
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("monaco-editor") ||
              id.includes("@monaco-editor/react")
            ) {
              return "monaco-editor";
            }
            if (id.includes("tesseract.js")) {
              return "tesseract";
            }
            if (id.includes("@microlink/react-json-view")) {
              return "react-json-view";
            }
            if (id.includes("node_modules")) {
              if (
                id.includes("/react/") ||
                id.includes("/react-dom/") ||
                id.includes("/scheduler/")
              ) {
                return "react-vendor";
              }
              if (
                id.includes("antd") ||
                id.includes("@ant-design") ||
                id.includes("/rc-") ||
                id.includes("@rc-component")
              ) {
                return "antd-vendor";
              }
              if (id.includes("@xyflow/react")) {
                return "xyflow-vendor";
              }
              if (
                id.includes("lodash") ||
                id.includes("ahooks") ||
                id.includes("classnames") ||
                id.includes("elkjs") ||
                id.includes("html-to-image") ||
                id.includes("jsonc-parser") ||
                id.includes("lz-string") ||
                id.includes("zustand")
              ) {
                return "misc-vendor";
              }
            }
            return undefined;
          },
        },
      },
    },
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
