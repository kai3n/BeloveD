import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    // The GitHub Pages project is served from /BeloveD/; the Vendor App is published under its /vendor/ subpath.
    base: process.env.GITHUB_PAGES ? "/BeloveD/vendor/" : process.env.VENDOR_BASE_PATH || "/",
    server: {
      port: 5174,
      proxy: env.BELOVED_API_PROXY
        ? { "/v1": { target: env.BELOVED_API_PROXY, changeOrigin: true } }
        : undefined,
    },
  };
});
