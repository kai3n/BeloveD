import { describe, it, expect } from "vitest";
import { chatMediaFiles, CHAT_MAX_BYTES } from "../chat.js";

const f = (type, name = "x") => ({ type, name });

describe("chatMediaFiles — 드래그앤드롭·붙여넣기·파일선택 공용 필터", () => {
  it("이미지·영상만 통과시킨다", () => {
    const list = [f("image/png"), f("video/mp4"), f("application/pdf"), f("text/plain"), f("image/gif"), f("video/quicktime")];
    expect(chatMediaFiles(list).map((x) => x.type)).toEqual(["image/png", "video/mp4", "image/gif", "video/quicktime"]);
  });

  it("빈/이상 입력은 빈 배열", () => {
    expect(chatMediaFiles(null)).toEqual([]);
    expect(chatMediaFiles(undefined)).toEqual([]);
    expect(chatMediaFiles([null, {}, { type: 123 }, "nope"])).toEqual([]);
  });

  it("최대 첨부 크기는 100MB", () => {
    expect(CHAT_MAX_BYTES).toBe(100 * 1024 * 1024);
  });
});
