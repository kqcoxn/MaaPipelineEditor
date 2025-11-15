import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => ({
  base: mode === "preview" ? "/MaaPipelineEditor/" : "/stable/",
  plugins: [react()],
}));
