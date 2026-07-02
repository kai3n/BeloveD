import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, listReviews, submitReview, setReviewStatus, updateOpsOrder, getOpsOrder,
} from "../store.js";

beforeEach(() => resetDB());

describe("고객 리뷰 — 인증·검수 규칙", () => {
  it("배송 완료(DELIVERED/ARCHIVED) 주문만 리뷰 작성 가능", () => {
    expect(() => submitReview("DM-000001", { rating: 5, quote: "great" })).toThrow("reviewNotAllowed");
    updateOpsOrder("DM-000001", { status: "DELIVERED" });
    const review = submitReview("DM-000001", {
      rating: 7, quote: "She said yes.", body: "call me 213-555-0100",
      media: Array.from({ length: 7 }, (_, i) => ({ kind: "image", src: `/m${i}.png` })),
    });
    expect(review.status).toBe("pending"); // 검수 전 미공개
    expect(review.rating).toBe(5); // 별점 클램프
    expect(review.media).toHaveLength(5); // 미디어 캡
    expect(review.body).not.toContain("213-555-0100"); // 연락처 마스킹
    expect(review.name).toBe(getOpsOrder("DM-000001").customerName);
  });

  it("pending은 공개 목록에 없고, publish 후 노출 · 주문당 1건", () => {
    updateOpsOrder("DM-000001", { status: "DELIVERED" });
    const review = submitReview("DM-000001", { rating: 5, quote: "wow" });
    const publishedBefore = listReviews({ publishedOnly: true }).length;
    expect(listReviews({ publishedOnly: true }).some((r) => r.id === review.id)).toBe(false);
    setReviewStatus(review.id, "published");
    expect(listReviews({ publishedOnly: true }).some((r) => r.id === review.id)).toBe(true);
    expect(listReviews({ publishedOnly: true }).length).toBe(publishedBefore + 1);
    // 중복 제출은 기존 리뷰 반환
    const again = submitReview("DM-000001", { rating: 4, quote: "again" });
    expect(again.id).toBe(review.id);
  });

  it("시드 데모 리뷰가 공개 상태로 존재한다", () => {
    expect(listReviews({ publishedOnly: true }).length).toBeGreaterThanOrEqual(6);
  });
});
