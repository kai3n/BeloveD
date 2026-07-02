import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages(프로젝트 페이지)는 /<repo>/ 하위 경로에서 서빙된다.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? "/lumina-lab/" : "/",
  define: {
    // 공개 배포(GitHub Pages)에서는 백오피스(어드민·스태프 로그인)를 번들에서 제외
    __WITH_BACKOFFICE__: JSON.stringify(!process.env.GITHUB_PAGES),
  },
  server: {
    // 로컬 개발: `npm run api`(8787)로 /v1 프록시 — 프로덕션(Vercel)과 같은 same-origin 형태
    proxy: { "/v1": "http://127.0.0.1:8787" },
  },
  test: {
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**", "**/server/**"],
  },
});
