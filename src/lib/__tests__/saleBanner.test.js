import { describe, expect, it } from "vitest";
import { resolveSaleBanner } from "../saleBanner.js";

const banner = { enabled: true, code: "LAUNCH25", copy: { en: "Launch Sale", ko: "런칭 세일", zh: "", es: "" } };

describe("resolveSaleBanner", () => {
  it("현재 로케일 문구를 쓴다", () => {
    expect(resolveSaleBanner(banner, "ko")).toEqual({ text: "런칭 세일", code: "LAUNCH25" });
  });
  it("빈 로케일은 EN 폴백", () => {
    expect(resolveSaleBanner(banner, "zh")).toEqual({ text: "Launch Sale", code: "LAUNCH25" });
  });
  it("disabled·EN까지 비면·설정 없음 → null", () => {
    expect(resolveSaleBanner({ ...banner, enabled: false }, "en")).toBeNull();
    expect(resolveSaleBanner({ enabled: true, code: "X", copy: { en: " " } }, "en")).toBeNull();
    expect(resolveSaleBanner(undefined, "en")).toBeNull();
  });
  it("코드가 비면 code는 빈 문자열", () => {
    expect(resolveSaleBanner({ ...banner, code: "" }, "en")).toEqual({ text: "Launch Sale", code: "" });
  });
});
