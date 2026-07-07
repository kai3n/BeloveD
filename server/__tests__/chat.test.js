// 라이브챗 — 익명 시작 → 스레드 스코프(격리) → 스태프 응대 → 로그인 연결 → 알림 스로틀/오프라인 폴백
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail } from "../mailer.js";
import { truncateAuth, truncateChat } from "./helpers.js";

const app = createApp();
const flush = () => new Promise((r) => setTimeout(r, 90));
const hasCookie = (res, name) => (res.headers["set-cookie"] || []).some((c) => c.startsWith(`${name}=`));

beforeEach(async () => {
  __resetRateLimit();
  await truncateChat();
  await truncateAuth();
  await query("delete from login_codes");
  drainMail();
});

async function adminCookie() {
  await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
    ["adm@b.com", "Adm", hashPassword("admin12345")]);
  const login = await request(app).post("/v1/auth/password").send({ email: "adm@b.com", password: "admin12345" });
  return login.headers["set-cookie"];
}

describe("라이브챗", () => {
  it("익명 방문자 첫 메시지 — 스레드 생성 + httpOnly bd_chat 쿠키", async () => {
    const res = await request(app).post("/v1/chat/messages").send({ body: "Hi, do you have oval diamonds?" });
    expect(res.status).toBe(201);
    expect(res.body.thread.code).toMatch(/^CHAT-\d+/);
    expect(res.body.message.sender).toBe("visitor");
    expect(res.body.message.body).toContain("oval");
    expect(res.body.staffAgent.name).toBeTruthy();
    expect(hasCookie(res, "bd_chat")).toBe(true);
    expect((res.headers["set-cookie"] || []).some((c) => /bd_chat=.*HttpOnly/i.test(c))).toBe(true);
  });

  it("빈 메시지(본문·첨부 모두 없음)는 400", async () => {
    expect((await request(app).post("/v1/chat/messages").send({ body: "   " })).status).toBe(400);
  });

  it("폴링은 자기 스레드만 — 쿠키 없는 방문자는 남의 스레드를 못 본다", async () => {
    const a = await request(app).post("/v1/chat/messages").send({ body: "A secret plan" });
    const aCookie = a.headers["set-cookie"];
    const mine = await request(app).get("/v1/chat/thread").set("Cookie", aCookie);
    expect(mine.body.messages.map((m) => m.body)).toContain("A secret plan");

    const anon = await request(app).get("/v1/chat/thread");
    expect(anon.body.thread).toBeNull();
    expect(anon.body.messages).toHaveLength(0);
  });

  it("스태프 응대 — 어드민만 인박스·답장, 방문자는 폴링으로 답장 수신", async () => {
    const admin = await adminCookie();
    const v = await request(app).post("/v1/chat/messages").send({ body: "Need help with sizing" });
    const vCookie = v.headers["set-cookie"];
    const code = v.body.thread.code;

    const inbox = await request(app).get("/v1/admin/chat/threads").set("Cookie", admin);
    const row = inbox.body.threads.find((t) => t.code === code);
    expect(row).toBeTruthy();
    expect(row.staffUnread).toBeGreaterThanOrEqual(1);

    // 인증 게이트: 비로그인·방문자 쿠키는 어드민 인박스 401
    expect((await request(app).get("/v1/admin/chat/threads")).status).toBe(401);
    expect((await request(app).get("/v1/admin/chat/threads").set("Cookie", vCookie)).status).toBe(401);

    const open = await request(app).get(`/v1/admin/chat/threads/${code}`).set("Cookie", admin);
    expect(open.status).toBe(200);
    expect(open.body.messages.some((m) => m.body.includes("sizing"))).toBe(true);

    const reply = await request(app).post(`/v1/admin/chat/threads/${code}/messages`).set("Cookie", admin)
      .send({ body: "Happy to help — what's your finger size?" });
    expect(reply.status).toBe(201);
    expect(reply.body.message.sender).toBe("staff");

    const poll = await request(app).get("/v1/chat/thread").set("Cookie", vCookie);
    expect(poll.body.messages.some((m) => m.sender === "staff")).toBe(true);
    // 방문자가 봤으니 customer_unread 0
    expect(poll.body.thread.customerUnread).toBe(0);
  });

  it("OTP 로그인 시 익명 스레드가 그 고객과 연결된다", async () => {
    const v = await request(app).post("/v1/chat/messages").send({ body: "pre-login question" });
    const vCookie = v.headers["set-cookie"];
    const code = v.body.thread.code;

    const req1 = await request(app).post("/v1/auth/code").set("Cookie", vCookie).send({ email: "buyer@test.com" });
    const login = await request(app).post("/v1/auth/code/verify").set("Cookie", vCookie)
      .send({ email: "buyer@test.com", code: req1.body.devCode });
    const custCookie = login.headers["set-cookie"];

    const poll = await request(app).get("/v1/chat/thread").set("Cookie", custCookie);
    expect(poll.body.thread.code).toBe(code);
    expect(poll.body.thread.customerId).toBeTruthy();
  });

  it("상담 알림은 스레드당 스로틀 — 연속 텍스트에 재발송 안 함", async () => {
    await adminCookie();
    const v = await request(app).post("/v1/chat/messages").send({ body: "first" });
    const vCookie = v.headers["set-cookie"];
    await flush();
    expect(drainMail().filter((m) => m.type === "chat_consultation").length).toBe(1);

    await request(app).post("/v1/chat/messages").set("Cookie", vCookie).send({ body: "second" });
    await flush();
    expect(drainMail().filter((m) => m.type === "chat_consultation").length).toBe(0);
  });

  it("FAQ 자동응답 — 기본 질문이면 컨시어지가 즉시 답한다", async () => {
    const res = await request(app).post("/v1/chat/messages").send({ body: "How much does a ring cost?", locale: "en" });
    expect(res.status).toBe(201);
    expect(res.body.autoReply).toBeTruthy();
    expect(res.body.autoReply.sender).toBe("staff");
    expect(res.body.autoReply.body.toLowerCase()).toContain("price");
    // 방문자 + 자동응답 2건이 스레드에 남는다
    const poll = await request(app).get("/v1/chat/thread").set("Cookie", res.headers["set-cookie"]);
    expect(poll.body.messages).toHaveLength(2);
  });

  it("한국어 질문엔 한국어로 자동응답, 매칭 안 되면 사람에게(자동응답 없음)", async () => {
    const ko = await request(app).post("/v1/chat/messages").send({ body: "배송은 얼마나 걸려요?", locale: "ko" });
    expect(ko.body.autoReply?.body).toMatch(/배송/);
    const none = await request(app).post("/v1/chat/messages").send({ body: "zzz qwerty gibberish", locale: "en" });
    expect(none.body.autoReply).toBeNull();
  });

  it("상담 요청은 대화 내용·첨부와 함께 support@belovediamond.com 로 전송", async () => {
    const res = await request(app).post("/v1/chat/messages").send({
      body: "Here is my inspiration photo",
      attachments: [{ url: "https://cdn.example.com/ring.jpg", contentType: "image/jpeg", name: "ring.jpg" }],
      locale: "en",
    });
    expect(res.status).toBe(201);
    await flush();
    const mails = drainMail().filter((m) => m.type === "chat_consultation");
    expect(mails.length).toBeGreaterThanOrEqual(1);
    expect(mails[0].to).toBe("support@belovediamond.com");
  });

  it("스태프 답장 시 고객 오프라인+이메일 알려짐이면 이메일 폴백, 온라인이면 안 보냄", async () => {
    const admin = await adminCookie();

    // 오프라인(폴링한 적 없음) + 이메일 제공
    const off = await request(app).post("/v1/chat/messages").send({ body: "email me", email: "off@test.com" });
    drainMail();
    await request(app).post(`/v1/admin/chat/threads/${off.body.thread.code}/messages`).set("Cookie", admin).send({ body: "replying" });
    await flush();
    const offMails = drainMail().filter((m) => m.type === "chat_customer_reply");
    expect(offMails.length).toBe(1);
    expect(offMails[0].to).toBe("off@test.com");

    // 온라인(방금 폴링) → 이메일 없음
    const on = await request(app).post("/v1/chat/messages").send({ body: "hi", email: "on@test.com" });
    const onCookie = on.headers["set-cookie"];
    await request(app).get("/v1/chat/thread").set("Cookie", onCookie); // last_seen=now
    drainMail();
    await request(app).post(`/v1/admin/chat/threads/${on.body.thread.code}/messages`).set("Cookie", admin).send({ body: "yo" });
    await flush();
    expect(drainMail().filter((m) => m.type === "chat_customer_reply").length).toBe(0);
  });

  it("since 커서 — 이후 메시지만 반환", async () => {
    const v = await request(app).post("/v1/chat/messages").send({ body: "m1" });
    const vCookie = v.headers["set-cookie"];
    const firstId = v.body.message.id;
    await request(app).post("/v1/chat/messages").set("Cookie", vCookie).send({ body: "m2" });
    const poll = await request(app).get(`/v1/chat/thread?since=${firstId}`).set("Cookie", vCookie);
    expect(poll.body.messages.map((m) => m.body)).toEqual(["m2"]);
  });

  it("이메일만 별도 저장 API — 잘못된 값 400, 정상은 스레드에 반영", async () => {
    const v = await request(app).post("/v1/chat/messages").send({ body: "hi" });
    const vCookie = v.headers["set-cookie"];
    const code = v.body.thread.code;
    expect((await request(app).post("/v1/chat/email").set("Cookie", vCookie).send({ email: "nope" })).status).toBe(400);
    expect((await request(app).post("/v1/chat/email").set("Cookie", vCookie).send({ email: "later@test.com" })).status).toBe(200);
    const { rows } = await query("select visitor_email from chat_threads where thread_code = $1", [code]);
    expect(rows[0].visitor_email).toBe("later@test.com");
  });
});
