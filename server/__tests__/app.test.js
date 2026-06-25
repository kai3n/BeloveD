import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

describe("app skeleton", () => {
  it("health returns ok with a database time", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.databaseTime).toBeTruthy();
  });
  it("unknown /v1 route returns the JSON error contract", async () => {
    const res = await request(app).get("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
