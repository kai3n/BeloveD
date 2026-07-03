import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { withTransaction } from "./db.js";
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
          // 같은 키의 동시 요청 직렬화 — check-then-act 레이스로 주문·메일이 중복 생성되는 것을 막는다
          const outcome = await withTransaction(async (client) => {
            await client.query("select pg_advisory_xact_lock(hashtext($1))", [`/v1/intakes:${idemKey}`]);
            const { rows } = await client.query(
              "select request_hash, status_code, response_json from idempotency_keys where route = $1 and idempotency_key = $2",
              ["/v1/intakes", idemKey],
            );
            if (rows[0]) {
              if (rows[0].request_hash !== requestHash(payload)) throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
              return { replay: true, status: rows[0].status_code, body: rows[0].response_json };
            }
            const draft = await createDraftIntake(payload);
            const result = await submitIntake(draft.intakeId);
            const body = { ok: true, orderCode: result.orderCode, stage: result.stage };
            await client.query(
              `insert into idempotency_keys (route, idempotency_key, request_hash, status_code, response_json)
               values ($1, $2, $3, 201, $4)`,
              ["/v1/intakes", idemKey, requestHash(payload), body],
            );
            return { replay: false, status: 201, body, result };
          });
          res.status(outcome.status).json(outcome.body);
          if (!outcome.replay && outcome.result.created && outcome.result.notify?.email) {
            fireMail(sendOrderEventMail({ ...outcome.result.notify, orderCode: outcome.result.orderCode, type: "received" }), "received");
          }
          return;
        }
        const draft = await createDraftIntake(payload);
        const result = await submitIntake(draft.intakeId);
        const body = { ok: true, orderCode: result.orderCode, stage: result.stage };
        res.status(201).json(body);
        if (result.created && result.notify?.email) {
          fireMail(sendOrderEventMail({ ...result.notify, orderCode: result.orderCode, type: "received" }), "received");
        }
      } catch (e) { next(e); }
    });

  return r;
}
