import { Router } from "express";
import { rateLimit } from "./rateLimit.js";
import { requireAdmin } from "./middleware.js";
import {
  listPublishedReviews, verifyReviewEligibility, submitCustomerReview,
  listAllReviews, saveAdminReview, deleteReviewByCode,
} from "./reviewRepository.js";

const MINUTE = 60 * 1000;

export function reviewRouter() {
  const r = Router();

  // 홈 Loved & Worn 피드 — 게시(published) 리뷰만 공개
  r.get("/reviews",
    rateLimit({ limit: 60, windowMs: MINUTE, keyFn: (req) => `reviews:${req.ip}` }),
    async (_req, res, next) => {
      try { res.json({ ok: true, reviews: await listPublishedReviews() }); } catch (e) { next(e); }
    });

  // 폼 진입 전 인증 — 로그인 고객은 소유권, 비로그인은 주문번호+운송장.
  // 타이트한 한도: 순번형 주문번호 + 운송장 조합의 무차별 대입 억제.
  r.post("/reviews/verify",
    rateLimit({ limit: 10, windowMs: MINUTE, keyFn: (req) => `review-verify:${req.ip}` }),
    async (req, res, next) => {
      try {
        const customerId = req.principal?.type === "customer" ? req.principal.id : null;
        await verifyReviewEligibility({ orderCode: req.body?.orderCode, tracking: req.body?.tracking, customerId });
        res.json({ ok: true });
      } catch (e) { next(e); }
    });

  // 제출 — pending으로 저장, 어드민 검수 후 게시
  r.post("/reviews",
    rateLimit({ limit: 5, windowMs: MINUTE, keyFn: (req) => `review-submit:${req.ip}` }),
    async (req, res, next) => {
      try {
        const customerId = req.principal?.type === "customer" ? req.principal.id : null;
        const review = await submitCustomerReview({ ...(req.body || {}), customerId });
        res.status(201).json({ ok: true, review });
      } catch (e) { next(e); }
    });

  // ── 어드민 큐레이션 — 홈 노출 리뷰 추가/수정/게시/숨김/삭제
  r.get("/admin/reviews",
    rateLimit({ limit: 60, windowMs: MINUTE, keyFn: (req) => `admin-reviews:${req.ip}` }),
    requireAdmin,
    async (_req, res, next) => {
      try { res.json({ ok: true, reviews: await listAllReviews() }); } catch (e) { next(e); }
    });

  r.post("/admin/reviews",
    rateLimit({ limit: 30, windowMs: MINUTE, keyFn: (req) => `admin-reviews:${req.ip}` }),
    requireAdmin,
    async (req, res, next) => {
      try { res.status(201).json({ ok: true, review: await saveAdminReview(req.body || {}) }); } catch (e) { next(e); }
    });

  r.patch("/admin/reviews/:reviewCode",
    rateLimit({ limit: 30, windowMs: MINUTE, keyFn: (req) => `admin-reviews:${req.ip}` }),
    requireAdmin,
    async (req, res, next) => {
      try {
        res.json({ ok: true, review: await saveAdminReview({ ...(req.body || {}), id: req.params.reviewCode }) });
      } catch (e) { next(e); }
    });

  r.delete("/admin/reviews/:reviewCode",
    rateLimit({ limit: 30, windowMs: MINUTE, keyFn: (req) => `admin-reviews:${req.ip}` }),
    requireAdmin,
    async (req, res, next) => {
      try { res.json(await deleteReviewByCode(req.params.reviewCode)); } catch (e) { next(e); }
    });

  return r;
}
