import { describe, expect, it } from "vitest";
import { maskContacts } from "../masking.js";

describe("maskContacts", () => {
  it("전화번호를 마스킹한다", () => {
    expect(maskContacts("연락주세요 010-1234-5678")).not.toContain("010-1234-5678");
    expect(maskContacts("call +82 10 1234 5678 now")).not.toContain("1234");
  });
  it("이메일을 마스킹한다", () => {
    expect(maskContacts("저는 foo.bar@gmail.com 입니다")).not.toContain("foo.bar@gmail.com");
  });
  it("URL을 마스킹한다", () => {
    expect(maskContacts("https://open.kakao.com/o/abc 로 오세요")).not.toContain("open.kakao.com");
    expect(maskContacts("visit www.mysite.co.kr please")).not.toContain("mysite");
  });
  it("SNS 아이디 패턴을 마스킹한다", () => {
    expect(maskContacts("카톡 아이디 jewel_master 추가요")).not.toContain("jewel_master");
    expect(maskContacts("insta @diamond.guy dm me")).not.toContain("diamond.guy");
  });
  it("일반 텍스트는 보존한다", () => {
    expect(maskContacts("밴드를 1mm 더 얇게 해주세요")).toBe("밴드를 1mm 더 얇게 해주세요");
  });
  it("빈 값은 그대로", () => {
    expect(maskContacts("")).toBe("");
    expect(maskContacts(null)).toBe(null);
  });
});
