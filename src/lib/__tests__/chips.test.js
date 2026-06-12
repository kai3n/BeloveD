import { describe, expect, it } from "vitest";
import { CHIP_PARTS, defaultChipCatalog, validateAnnotation, formatAnnotation } from "../chips.js";

const catalog = defaultChipCatalog();

describe("chips — 무언어 칩 어휘 사전", () => {
  it("모든 칩이 4개 언어 라벨을 가진다", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(10);
    for (const c of catalog) {
      for (const loc of ["en", "zh", "ko", "es"]) expect(c.labels[loc], `${c.key}.${loc}`).toBeTruthy();
    }
  });

  it("validateAnnotation — 유효/무효 판정", () => {
    const ok = { pinId: 1, x: 50, y: 30, part: "band", chipKey: "thinner", value: 1.6 };
    expect(validateAnnotation(ok, catalog)).toBe(true);
    expect(validateAnnotation({ ...ok, x: 101 }, catalog)).toBe(false);            // 좌표 범위
    expect(validateAnnotation({ ...ok, part: "engine" }, catalog)).toBe(false);    // 미지의 부위
    expect(validateAnnotation({ ...ok, part: "band", chipKey: "prong6" }, catalog)).toBe(false); // 칩-부위 불일치
    expect(validateAnnotation({ ...ok, value: null }, catalog)).toBe(false);       // mm 칩인데 값 없음
    expect(validateAnnotation({ pinId: 2, x: 10, y: 10, part: "prong", chipKey: "prong6", value: 3 }, catalog)).toBe(false); // none 칩인데 값 있음
    expect(validateAnnotation({ pinId: 2, x: 10, y: 10, part: "prong", chipKey: "prong6" }, catalog)).toBe(true);
  });

  it("formatAnnotation — 같은 주석이 ko/zh로 각각 렌더링", () => {
    const a = { pinId: 1, x: 50, y: 30, part: "band", chipKey: "thinner", value: 1.6 };
    expect(formatAnnotation(a, catalog, "ko", { band: "밴드" })).toBe("밴드 · 더 얇게 → 1.6mm");
    expect(formatAnnotation(a, catalog, "zh", { band: "戒臂" })).toBe("戒臂 · 更细 → 1.6mm");
  });

  it("CHIP_PARTS 고정 목록", () => {
    expect(CHIP_PARTS).toContain("band");
    expect(CHIP_PARTS).toContain("prong");
  });
});
