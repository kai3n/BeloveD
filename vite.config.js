import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages(프로젝트 페이지)는 /<repo>/ 하위 경로에서 서빙된다.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? "/lumina-lab/" : "/",
});
