import { describe, expect, it } from "vitest";
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_COLOR_DEFAULT, TOTAL_CARAT_RANGES,
  caratRangeMid, clampCaratRange, clampGradeRange, clampTotalCaratRange, formatCaratRange, formatGradeRange,
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

describe("clampCaratRange / clampTotalCaratRange", () => {
  it("단일 레거시 값 → [v,v] (문자열 숫자화)", () => {
    expect(clampTotalCaratRange("bangle", "5")).toEqual([5, 5]);
  });
  it("경계 밖 값은 경계로 클램프", () => {
    expect(clampTotalCaratRange("ring", [0.1, 99])).toEqual([0.5, 5]);
  });
  it("역전 입력 정렬", () => {
    expect(clampTotalCaratRange("bangle", [6, 4])).toEqual([4, 6]);
  });
  it("무효 입력 → 카테고리 기본 range", () => {
    expect(clampTotalCaratRange("necklace", null)).toEqual(TOTAL_CARAT_RANGES.necklace.defaultRange);
  });
  it("한쪽만 유효하면 그 값으로 채운다", () => {
    expect(clampCaratRange(TOTAL_CARAT_RANGES.ring, [2, "x"])).toEqual([2, 2]);
  });
});

describe("formatCaratRange / caratRangeMid", () => {
  it("range 라벨", () => expect(formatCaratRange([1.5, 2])).toBe("1.50–2.00ct"));
  it("단일 라벨", () => expect(formatCaratRange([1.5, 1.5])).toBe("1.50ct"));
  it("빈 입력은 빈 문자열", () => expect(formatCaratRange(null)).toBe(""));
  it("중간값", () => expect(caratRangeMid([1, 2])).toBe(1.5));
});
