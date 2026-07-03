import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { query } from "./db.js";
import { createDraftIntake, submitIntake, requestHash } from "./customerRepository.js";
import { sendOrderEventMail } from "./orderMail.js";

const MINUTE = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 메일은 응답 이후 fire-and-forget — 발송 실패가 제출/이벤트를 실패시키지 않는다 (스펙 §5)
function fireMail(promise, label) {
  promise.catch((e) => console.error(`[orderMail] ${label}: ${e.message}`));
}

export function customerRouter() {
  const r = Router();

  // 인테이크 제출 — draft 생성+제출 원샷. 더블클릭/재시도는 Idempotency-Key로 흡수.
  r.post("/intakes",
    rateLimit({ limit: 5, windowMs: MINUTE }),
    async (req, res, next) => {
      try {
        const payload = req.body || {};
        const email = String(payload.contactEmail || payload.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) throw new ApiError("VALIDATION_ERROR", 400, "contact email required");
        const idemKey = req.get("Idempotency-Key") || null;
        if (idemKey) {
          const { rows } = await query(
            "select request_hash, status_code, response_json from idempotency_keys where route = $1 and idempotency_key = $2",
            ["/v1/intakes", idemKey],
          );
          if (rows[0]) {
            if (rows[0].request_hash !== requestHash(payload)) throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
            return res.status(rows[0].status_code).json(rows[0].response_json); // 재생 — 메일 재발송 없음
          }
        }
        const draft = await createDraftIntake(payload);
        const result = await submitIntake(draft.intakeId);
        const body = { ok: true, orderCode: result.orderCode, stage: result.stage };
        if (idemKey) {
          await query(
            `insert into idempotency_keys (route, idempotency_key, request_hash, status_code, response_json)
             values ($1, $2, $3, 201, $4) on conflict do nothing`,
            ["/v1/intakes", idemKey, requestHash(payload), body],
          );
        }
        res.status(201).json(body);
        if (result.created && result.notify?.email) {
          fireMail(sendOrderEventMail({ ...result.notify, orderCode: result.orderCode, type: "received" }), "received");
        }
      } catch (e) { next(e); }
    });

  return r;
}
