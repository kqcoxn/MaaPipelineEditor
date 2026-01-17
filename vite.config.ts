import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  let base = "/stable/";
  if (mode === "preview") {
    base = "/MaaPipelineEditor/";
  } else if (mode === "extremer") {
    base = "/";
  } else if (mode !== "stable") {
    base = `/${mode}/`;
  }
  return {
    base,
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
