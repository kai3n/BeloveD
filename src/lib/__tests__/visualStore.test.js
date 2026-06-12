import { beforeEach, describe, expect, it } from "vitest";
import { resetDB, listChips, saveChip } from "../store.js";

beforeEach(() => resetDB());

describe("visual store — 칩 카탈로그", () => {
  it("시드에 칩 카탈로그가 있고 부위 필터가 동작한다", () => {
    expect(listChips().length).toBeGreaterThanOrEqual(10);
    const bandChips = listChips({ part: "band" });
    expect(bandChips.some((c) => c.key === "thinner")).toBe(true);
    expect(bandChips.some((c) => c.key === "prong6")).toBe(false); // 프롱 전용
  });

  it("saveChip — 비활성화하면 목록에서 빠진다", () => {
    const chip = listChips().find((c) => c.key === "polishMatte");
    saveChip({ ...chip, active: false });
    expect(listChips().some((c) => c.key === "polishMatte")).toBe(false);
  });
});
