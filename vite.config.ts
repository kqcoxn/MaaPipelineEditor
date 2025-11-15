import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  // 根据构建模式动态设置 base 路径
  let base = "/stable/"; // 默认为稳定版
  if (mode === "preview") {
    base = "/MaaPipelineEditor/";
  } else {
    base = `/${mode}/`;
  }

  return {
    base,
    plugins: [react()],
  };
});
