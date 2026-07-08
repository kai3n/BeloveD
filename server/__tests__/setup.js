import { beforeAll, afterAll } from "vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost:5432/belovediamond_test";
process.env.NODE_ENV = "test";
// 첨부 URL 검증(R2 오리진 한정)이 테스트에서도 동작하도록 공개 베이스를 지정
process.env.R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://cdn.example.com";

const { migrate } = await import("../migrate.js");
const { closePool } = await import("../db.js");

beforeAll(async () => { await migrate(); });
afterAll(async () => { await closePool(); });
