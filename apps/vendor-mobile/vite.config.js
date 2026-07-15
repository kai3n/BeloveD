import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    // GitHub Pages 项目站位于 /BeloveD/；Vendor App 独立发布到其 /vendor/ 子路径。
    base: process.env.GITHUB_PAGES ? "/BeloveD/vendor/" : "/",
    server: {
      port: 5174,
      proxy: env.BELOVED_API_PROXY
        ? { "/v1": { target: env.BELOVED_API_PROXY, changeOrigin: true } }
        : undefined,
    },
  };
});
