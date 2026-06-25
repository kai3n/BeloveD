import { describe, it, expect } from "vitest";
import { withTransaction } from "../db.js";
import { nextCode } from "../codes.js";

describe("nextCode", () => {
  it("formats a zero-padded public code", async () => {
    const code = await withTransaction((c) => nextCode(c, "BD"));
    expect(code).toMatch(/^BD-\d{6}$/);
  });
  it("increments monotonically", async () => {
    const [a, b] = await withTransaction(async (c) => [await nextCode(c, "BD"), await nextCode(c, "BD")]);
    expect(Number(b.slice(3))).toBe(Number(a.slice(3)) + 1);
  });
});
