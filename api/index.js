// Vercel 서버리스 진입점 — Express 앱 자체가 (req, res) 핸들러다.
// 모든 /v1/* 요청이 vercel.json rewrites로 이 함수에 도착한다.
import { createApp } from "../server/app.js";

const app = createApp();
export default app;
