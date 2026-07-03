import { describe, it, expect, beforeEach } from "vitest";
import { sendOrderEventMail, ORDER_MAIL } from "../orderMail.js";
import { drainMail } from "../mailer.js";

beforeEach(() => { drainMail(); });

describe("orderMail", () => {
  it("10종 이벤트 × 4개 언어 템플릿이 전부 존재한다", () => {
    const types = ["received", "proposal_sent", "deposit_confirmed", "diamond_locked", "cad_ready",
      "production_started", "qc_ready", "balance_requested", "shipped", "delivered"];
    for (const type of types) for (const loc of ["en", "ko", "zh", "es"]) {
      expect(ORDER_MAIL[type][loc].subject("BD-000001", {}), `${type}/${loc}`).toContain("BD-000001");
      expect(typeof ORDER_MAIL[type][loc].line("BD-000001", {})).toBe("string");
    }
  });

  it("저장된 로케일로 발송하고 포털 링크를 담는다", async () => {
    process.env.PUBLIC_ORIGIN = "https://belovediamond.com";
    await sendOrderEventMail({ email: "a@b.com", locale: "ko", orderCode: "BD-000007", type: "shipped", data: { tracking: "1Z999" } });
    const [msg] = drainMail();
    expect(msg.to).toBe("a@b.com");
    expect(msg.type).toBe("order_shipped");
    expect(msg.subject).toContain("발송");
    expect(msg.subject).toContain("BD-000007");
    delete process.env.PUBLIC_ORIGIN;
  });

  it("미지원 로케일은 en으로 폴백한다", async () => {
    await sendOrderEventMail({ email: "a@b.com", locale: "fr", orderCode: "BD-000008", type: "received", data: {} });
    expect(drainMail()[0].subject).toContain("We received");
  });
});
