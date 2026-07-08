import { describe, expect, it } from "vitest";
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_COLOR_DEFAULT, TOTAL_CARAT_RANGES,
  clampGradeRange, clampTotalCarat, formatGradeRange,
} from "../gradeScale.js";

describe("clampGradeRange", () => {
  it("단일 레거시 값 → [v,v]", () => {
    expect(clampGradeRange(COLOR_SCALE, "E", MULTI_COLOR_DEFAULT)).toEqual(["E", "E"]);
  });
  it("역전 입력은 정렬된다", () => {
    expect(clampGradeRange(COLOR_SCALE, ["D", "F"], MULTI_COLOR_DEFAULT)).toEqual(["F", "D"]);
  });
  it("IF/FL 단일값은 IF-FL 눈금으로 병합", () => {
    expect(clampGradeRange(CLARITY_SCALE, "IF", ["VS2", "VVS1"])).toEqual(["IF-FL", "IF-FL"]);
  });
  it("스케일 밖 값만 있으면 폴백", () => {
    expect(clampGradeRange(COLOR_SCALE, ["Z", "Q"], MULTI_COLOR_DEFAULT)).toEqual(MULTI_COLOR_DEFAULT);
  });
  it("null/undefined → 폴백 복사본", () => {
    const out = clampGradeRange(COLOR_SCALE, null, MULTI_COLOR_DEFAULT);
    expect(out).toEqual(MULTI_COLOR_DEFAULT);
    expect(out).not.toBe(MULTI_COLOR_DEFAULT);
  });
  it("한쪽만 유효하면 그 값으로 채운다", () => {
    expect(clampGradeRange(COLOR_SCALE, ["E", "Q"], MULTI_COLOR_DEFAULT)).toEqual(["E", "E"]);
  });
});

describe("formatGradeRange", () => {
  it("상급 먼저 표기 (D–F)", () => expect(formatGradeRange(["F", "D"])).toBe("D–F"));
  it("단일 등급은 한 글자", () => expect(formatGradeRange(["E", "E"])).toBe("E"));
  it("빈 입력은 빈 문자열", () => expect(formatGradeRange(null)).toBe(""));
});

describe("clampTotalCarat", () => {
  it("범위 밖 → 카테고리 기본값", () => {
    expect(clampTotalCarat("ring", 99)).toBe(TOTAL_CARAT_RANGES.ring.default);
    expect(clampTotalCarat("ring", null)).toBe(TOTAL_CARAT_RANGES.ring.default);
  });
  it("정상 문자열 값 통과(숫자화)", () => expect(clampTotalCarat("bangle", "5")).toBe(5));
  it("모르는 카테고리는 ring 기준", () => {
    expect(clampTotalCarat("watch", 2)).toBe(2);
  });
});
