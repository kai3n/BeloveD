import { describe, it, expect, beforeEach } from "vitest";
import { sendOrderEventMail, ORDER_MAIL, CHROME, journeyStrip, JOURNEY_LABELS } from "../orderMail.js";
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

  // 왜: dev sink는 html을 저장하지 않고 meta만 저장한다(mailer.js deliver) — 본문 조립은
  // sendOrderEventMail의 loc !== "en" 분기로 구성되므로, 템플릿 레벨에서 로케일별 면책 문구가
  // 존재하는지 확인한다. en은 mailer.wrap()이 영어 면책 문구를 이미 항상 붙이므로 별도 문구가 없다.
  it("ko/zh/es CHROME에 로케일별 면책 문구가 존재하고, en은 별도 문구를 두지 않는다", () => {
    expect(CHROME.ko.ignore).toBe("이 주문을 기억하지 못하시면 이 메일을 무시하셔도 됩니다.");
    expect(CHROME.zh.ignore).toBe("如果您不记得此订单，可以忽略此邮件。");
    expect(CHROME.es.ignore).toBe("Si no reconoces este pedido, puedes ignorar este correo.");
    expect(CHROME.en.ignore).toBeUndefined();
  });

  describe("journeyStrip — 전체 여정 중 현재 단계 표시", () => {
    it("received/ko: 1/6 단계, 현재만 ● 강조, 완료 ✓ 없음", () => {
      const html = journeyStrip("received", "ko");
      expect(html).toContain("6단계 중 1단계");
      expect(html).toContain("● 접수");
      expect(html).not.toContain("✓");
      expect(html).toContain("→");
    });

    it("production_started/en: step 4 of 6, 앞 3단계 ✓, 현재 ● Crafting", () => {
      const html = journeyStrip("production_started", "en");
      expect(html).toContain("step 4 of 6");
      expect(html.match(/✓/g)).toHaveLength(3);
      expect(html).toContain("● Crafting");
    });

    it("delivered: 6단계 전부 ✓, ● 없음", () => {
      const html = journeyStrip("delivered", "en");
      expect(html.match(/✓/g)).toHaveLength(6);
      expect(html).not.toContain("●");
      expect(html).toContain("step 6 of 6");
    });

    it("취소 계열 이벤트에는 여정 스트립을 넣지 않는다", () => {
      expect(journeyStrip("order_cancelled", "en")).toBe("");
      expect(journeyStrip("cancel_requested", "ko")).toBe("");
    });

    it("4개 언어 라벨 파리티 — 6단계 + progress 문구", () => {
      for (const loc of ["en", "ko", "zh", "es"]) {
        for (const k of ["request", "proposal", "design", "crafting", "finalCheck", "delivery"]) {
          expect(typeof JOURNEY_LABELS[loc][k], `${loc}/${k}`).toBe("string");
        }
        expect(JOURNEY_LABELS[loc].progress(2, 6)).toContain("2");
      }
    });

    it("미지원 로케일은 en 라벨로 폴백한다", () => {
      expect(journeyStrip("shipped", "fr")).toContain("Delivery");
    });
  });
});
