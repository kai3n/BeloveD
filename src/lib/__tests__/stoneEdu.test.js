import { describe, expect, it } from "vitest";
import { opsStrings } from "../../opsStrings.js";
import {
  EDU_FIELDS, COLOR_SCALE, COLOR_TINTS, CLARITY_SCALE, CLARITY_DOTS,
  FLUOR_LEVELS, CARAT_REFS, RATIO_EXAMPLES, caratDiameterMm, nearestIndex,
} from "../stoneEdu.js";

describe("stoneEdu — 센터스톤 교육 데이터/계산", () => {
  it("EDU_FIELDS — 인테이크 센터스톤 8개 필드와 일치", () => {
    expect(EDU_FIELDS).toEqual(["shape", "carat", "color", "clarity", "growth", "lab", "fluorescence", "lwRatio"]);
  });

  it("스케일 무결성 — 컬러 D 시작, 클래리티 내포물 단조 증가, 틴트 전체 존재", () => {
    expect(COLOR_SCALE[0]).toBe("D");
    expect(COLOR_SCALE).toContain("J");
    for (const g of COLOR_SCALE) expect(COLOR_TINTS[g], g).toMatch(/^#/);
    expect(CLARITY_SCALE).toEqual(["IF", "VVS1", "VVS2", "VS1", "VS2"]);
    expect(CLARITY_DOTS.IF).toBe(0);
    for (let i = 1; i < CLARITY_SCALE.length; i++) {
      expect(CLARITY_DOTS[CLARITY_SCALE[i]]).toBeGreaterThan(CLARITY_DOTS[CLARITY_SCALE[i - 1]]);
    }
    expect(FLUOR_LEVELS).toEqual(["none", "faint", "medium"]); // 폼 select value와 동일 (소문자)
    expect(CARAT_REFS).toContain(1.5);
    expect(RATIO_EXAMPLES[0]).toBe(1.0);
  });

  it("caratDiameterMm — 1ct ≈ 6.45mm, 단조 증가, 무효 입력은 null", () => {
    expect(caratDiameterMm(1)).toBeCloseTo(6.45, 2);
    expect(caratDiameterMm(2)).toBeGreaterThan(caratDiameterMm(1.5));
    expect(caratDiameterMm("1.5")).toBeCloseTo(6.45 * Math.cbrt(1.5), 4); // 폼 값은 문자열
    expect(caratDiameterMm("")).toBeNull();
    expect(caratDiameterMm(0)).toBeNull();
    expect(caratDiameterMm(-1)).toBeNull();
  });

  it("4개 언어 stoneEdu 파리티 — kicker + 8필드 × title/body/guide", () => {
    for (const loc of ["en", "ko", "zh", "es"]) {
      const edu = opsStrings[loc].stoneEdu;
      expect(edu, `${loc}.stoneEdu`).toBeTruthy();
      expect(edu.kicker, `${loc}.kicker`).toBeTruthy();
      for (const f of EDU_FIELDS) {
        for (const k of ["title", "body", "guide"]) {
          expect(edu[f]?.[k], `${loc}.${f}.${k}`).toBeTruthy();
        }
      }
    }
  });

  it("nearestIndex — 최근접 기준값 인덱스, 파싱 불가면 -1", () => {
    expect(nearestIndex(CARAT_REFS, 1.4)).toBe(2);  // 1.5가 최근접
    expect(nearestIndex(CARAT_REFS, "2.2")).toBe(3); // 2
    expect(nearestIndex(CARAT_REFS, 99)).toBe(4);    // 3 (마지막)
    expect(nearestIndex(CARAT_REFS, "")).toBe(-1);
    expect(nearestIndex(CARAT_REFS, "abc")).toBe(-1);
  });
});
