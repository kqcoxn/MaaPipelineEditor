import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  let base = "/stable/";
  if (mode === "preview") {
    base = "/MaaPipelineEditor/";
  } else if (mode !== "stable") {
    base = `/${mode}/`;
  }
  return {
    base,
    plugins: [react()],
  };
});
