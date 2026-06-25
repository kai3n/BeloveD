import { beforeAll, afterAll } from "vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost:5432/belovediamond_test";
process.env.NODE_ENV = "test";

const { migrate } = await import("../migrate.js");
const { closePool } = await import("../db.js");

beforeAll(async () => { await migrate(); });
afterAll(async () => { await closePool(); });
