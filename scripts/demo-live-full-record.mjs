// Live (BD-) full order journey recording — homepage → custom request wizard →
// customer OTP sign-in → admin proposal → customer REQUESTS CHANGES → revised
// proposal → approve → shipping address → deposit → diamond locked → production →
// finished-piece QC → balance → shipped (tracking) → delivered.
// Two panes (customer left, admin right), slow pacing for a watchable walkthrough.
//
// Usage: with the local stack running (vite :5173 + API :8787 against the dev DB):
//   DEMO_ADMIN_PASSWORD=... node scripts/demo-live-full-record.mjs # records demo-video/live-order-flow-en.mp4
//   DRY=1 node scripts/demo-live-full-record.mjs    # fast headless dry-run, no video
//   DEMO_SPEED=0.25 node scripts/demo-live-full-record.mjs # faster capture for constrained runners
//
// 실서버 플로우 녹화 — API를 EXPOSE_DEV_AUTH_SECRETS=true로 실행해 녹화기가
// 응답의 devCode(OTP)를 읽을 수 있어야 한다. 화면에는 코드를 노출하지 않는다.

import { chromium } from "playwright";
import { mkdir, rm, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const DRY = process.env.DRY === "1";
const BASE = process.env.DEMO_BASE_URL || "http://127.0.0.1:5173";
const OUT_DIR = "demo-video";
const OUT_FILE = `${OUT_DIR}/live-order-flow-en.mp4`;
const PANE = { width: 900, height: 820 };
const requestedSpeed = Number(process.env.DEMO_SPEED ?? 1.3);
const SLOW = DRY ? 0 : (Number.isFinite(requestedSpeed) && requestedSpeed >= 0 ? requestedSpeed : 1.3);
const requestedCrf = Number(process.env.DEMO_VIDEO_CRF ?? 18);
const VIDEO_CRF = Number.isFinite(requestedCrf) && requestedCrf >= 0 && requestedCrf <= 51 ? requestedCrf : 18;
const ADMIN = { email: process.env.DEMO_ADMIN_EMAIL || "admin@belovediamond.test", password: process.env.DEMO_ADMIN_PASSWORD || "" };
const CUSTOMER = { name: "Jiwon Kim", email: `jiwon.demo+${Date.now()}@belovediamond.test` };
const ADMIN_BASE = "/bo-4q9z7m";
const ASSET = (name) => new URL(`../public/assets/${name}`, import.meta.url).pathname;
const REQUIRED_STYLE_NAME = "Four-Prong Solitaire Ring";

const ROLE_STYLE = {
  customer: { bg: "#1f6f43", label: "CUSTOMER · Jiwon Kim" },
  admin: { bg: "#8a5a1e", label: "ADMIN · BeloveD live orders" },
};

let customerPage;
let adminPage;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, DRY ? Math.min(ms, 120) : Math.round(ms * SLOW)));
const paneOf = (role) => (role === "customer" ? customerPage : adminPage);
const log = (msg) => console.log(`  · ${msg}`);

const CURSOR_INIT = () => {
  function ensureCursor() {
    const existing = document.getElementById("demo-cursor");
    if (existing) return existing;
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.style.cssText = [
      "position:fixed", "left:50%", "top:40%", "width:24px", "height:24px",
      "border-radius:50%", "border:2px solid #fff", "background:rgba(255,255,255,.25)",
      "box-shadow:0 0 0 2px rgba(0,0,0,.45),0 3px 10px rgba(0,0,0,.45)",
      "z-index:2147483647", "pointer-events:none", "transform:translate(-50%,-50%)",
      "transition:left .48s cubic-bezier(.4,0,.2,1),top .48s cubic-bezier(.4,0,.2,1)",
    ].join(";");
    (document.body || document.documentElement).appendChild(cursor);
    return cursor;
  }
  window.__demoCursorMove = (x, y) => {
    const cursor = ensureCursor();
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  };
  window.__demoCursorClick = (x, y) => {
    ensureCursor();
    const ripple = document.createElement("div");
    ripple.style.cssText = [
      "position:fixed", `left:${x}px`, `top:${y}px`, "width:16px", "height:16px",
      "border-radius:50%", "background:rgba(255,205,110,.88)",
      "z-index:2147483646", "pointer-events:none", "transform:translate(-50%,-50%)",
    ].join(";");
    (document.body || document.documentElement).appendChild(ripple);
    ripple.animate(
      [
        { opacity: 0.92, transform: "translate(-50%,-50%) scale(1)" },
        { opacity: 0, transform: "translate(-50%,-50%) scale(4.5)" },
      ],
      { duration: 620, easing: "ease-out" },
    );
    setTimeout(() => ripple.remove(), 650);
  };
  window.__demoHighlight = (x, y, width, height) => {
    const box = document.createElement("div");
    box.style.cssText = [
      "position:fixed", `left:${x}px`, `top:${y}px`, `width:${width}px`, `height:${height}px`,
      "border:2.5px solid #ffcd6e", "border-radius:7px",
      "box-shadow:0 0 0 3px rgba(255,205,110,.28)", "background:rgba(255,205,110,.12)",
      "z-index:2147483645", "pointer-events:none", "transition:opacity .42s",
    ].join(";");
    (document.body || document.documentElement).appendChild(box);
    setTimeout(() => {
      box.style.opacity = "0";
      setTimeout(() => box.remove(), 450);
    }, 920);
  };
};

async function banner(page, role, step) {
  const style = ROLE_STYLE[role];
  await page.evaluate(({ bg, label, stepText }) => {
    document.getElementById("demo-banner")?.remove();
    const bannerEl = document.createElement("div");
    bannerEl.id = "demo-banner";
    bannerEl.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483640",
      `background:${bg}`, "color:#fff",
      "font:600 15px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "padding:10px 18px", "display:flex", "justify-content:space-between",
      "align-items:center", "box-shadow:0 2px 12px rgba(0,0,0,.22)",
    ].join(";");
    bannerEl.innerHTML = `<span>${label}</span><span style="opacity:.86;font-weight:500">${stepText}</span>`;
    document.body.appendChild(bannerEl);
    document.body.style.paddingTop = "44px";
  }, { ...style, stepText: step });
}

async function go(role, path, step, { waitFor = null } = {}) {
  const page = paneOf(role);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (waitFor) await page.locator(waitFor).first().waitFor({ state: "visible", timeout: 15000 });
  await banner(page, role, step);
  await page.bringToFront();
  await wait(1000);
  log(`[${role}] ${path} — ${step}`);
}

async function point(role, locator) {
  const page = paneOf(role);
  const loc = locator.first();
  await loc.waitFor({ state: "visible", timeout: 12000 });
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  if (!box) return null;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.evaluate(({ x, y, bx, by, w, h }) => {
    window.__demoCursorMove(x, y);
    window.__demoHighlight(bx, by, w, h);
  }, { x: cx, y: cy, bx: box.x, by: box.y, w: box.width, h: box.height });
  await wait(480);
  return { x: cx, y: cy };
}

async function tap(role, locator) {
  const page = paneOf(role);
  const loc = locator.first();
  const p = await point(role, loc);
  if (p) await page.evaluate(({ x, y }) => window.__demoCursorClick(x, y), p);
  await wait(180);
  await loc.click();
  await wait(850);
}

async function fillField(role, locator, value) {
  const loc = locator.first();
  await point(role, loc);
  await loc.fill(value);
  await wait(360);
}

// 어드민 스텝카드 — 현재 열린(active) 섹션 안에서 동작한다
const activeStep = () => adminPage.locator(".client-stage-section.active").first();

// Send 후 반드시 다음 스텝이 열릴 때까지 대기 — 리프레시 지연 중 재클릭하면 이벤트가 중복 발행된다
async function adminSend(name, nextTitle = null) {
  // The success notice persists between sends, so it cannot prove that the
  // current click reached the server. Observe this exact event POST instead.
  const eventResponse = adminPage.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST"
      && /^\/v1\/admin\/orders\/[^/]+\/events$/.test(url.pathname);
  }, { timeout: 20000 });
  const [response] = await Promise.all([
    eventResponse,
    tap("admin", activeStep().getByRole("button", { name })),
  ]);
  const result = await response.json().catch(() => null);
  if (!response.ok() || result?.ok !== true) {
    throw new Error(`admin event failed (${response.status()} ${result?.error?.code || "INVALID_RESPONSE"})`);
  }
  if (nextTitle) {
    await adminPage.locator(".client-stage-section.active", { hasText: nextTitle }).first().waitFor({ timeout: 20000 });
  }
  await wait(1500);
}

async function apiPreflight(path, label) {
  const url = new URL(path, `${BASE.replace(/\/$/, "")}/`);
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`${label} is unreachable at ${url.origin}`);
  }
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

async function preflight() {
  const problems = [];
  const endpoints = [
    ["health", "/v1/health", "API health"],
    ["designs", "/v1/designs", "published catalog"],
    ["settings", "/v1/settings/public", "public settings"],
    ["media", "/v1/media/status", "media provider"],
  ];
  const results = await Promise.allSettled(endpoints.map(([, path, label]) => apiPreflight(path, label)));
  const data = {};
  results.forEach((result, index) => {
    const [key, , label] = endpoints[index];
    if (result.status === "fulfilled") data[key] = result.value;
    else problems.push(`${label}: ${result.reason.message}`);
  });

  if (data.health && data.health.ok !== true) problems.push("API health: response was not healthy");
  if (data.designs) {
    const styles = Array.isArray(data.designs.styles) ? data.designs.styles : [];
    const hasRequiredStyle = styles.some((style) => (
      style?.name?.en === REQUIRED_STYLE_NAME || style?.name === REQUIRED_STYLE_NAME
    ));
    if (!hasRequiredStyle) {
      problems.push(`published catalog: ${REQUIRED_STYLE_NAME} is missing; run \`node scripts/push-catalog-to-server.mjs\``);
    }
  }
  if (data.settings) {
    const payment = data.settings.settings?.payment || {};
    if (![payment.zelle, payment.venmo].some((value) => String(value || "").trim())) {
      problems.push(`public settings: configure at least one Zelle/Venmo recipient at ${BASE}${ADMIN_BASE}/payments`);
    }
  }
  if (data.media && (!data.media.configured || !["local", "r2"].includes(data.media.provider))) {
    problems.push("media provider: configure R2 or run the API in non-production mode for local media uploads");
  }

  // The activity endpoint depends on migration 0013. This query is read-only;
  // DATABASE_URL must be the same value used by the API process.
  try {
    const { query, closePool } = await import("../server/db.js");
    try {
      const { rows } = await query(
        `select exists (
           select 1 from information_schema.columns
           where table_schema = current_schema()
             and table_name = 'activity_events'
             and column_name = 'client_event_id'
         ) as ready`,
      );
      if (!rows[0]?.ready) problems.push("database: migration 0013 is missing; run `npm run db:migrate`");
    } finally {
      await closePool();
    }
  } catch (error) {
    problems.push(`database: could not verify migrations (${error.code || error.message}); use the API's DATABASE_URL`);
  }

  if (problems.length > 0) {
    throw new Error(["Live demo preflight failed:", ...problems.map((problem) => `- ${problem}`)].join("\n"));
  }
  log(`preflight passed — catalog, payment settings, ${data.media.provider} media, database`);
}

async function main() {
  if (!ADMIN.password) throw new Error("DEMO_ADMIN_PASSWORD is required for live recording");
  await preflight();
  await mkdir(OUT_DIR, { recursive: true });
  if (!DRY) await rm(OUT_FILE, { force: true });
  const browser = await chromium.launch();
  // 고객·어드민은 반드시 컨텍스트 분리 — 서버 세션 쿠키가 섞이면 고객 팬이 어드민으로 로그인된다
  const makeContext = async () => {
    const ctx = await browser.newContext({
      viewport: PANE,
      ...(DRY ? {} : { recordVideo: { dir: OUT_DIR, size: PANE } }),
    });
    await ctx.addInitScript(({ lang, theme }) => {
      localStorage.setItem("lumina-locale", lang);
      localStorage.setItem("lumina-theme", theme);
    }, { lang: "en", theme: "day" });
    await ctx.addInitScript(CURSOR_INIT);
    return ctx;
  };
  const customerContext = await makeContext();
  const adminContext = await makeContext();

  customerPage = await customerContext.newPage();
  adminPage = await adminContext.newPage();
  // 운영 콘솔은 상태 변경 전에 확인 대화상자를 띄운다. 녹화도 실제 사용자와
  // 같은 확인 단계를 통과해야 하므로 어드민 컨텍스트의 확인창만 승인한다.
  adminPage.on("dialog", (dialog) => dialog.accept());

  if (process.env.DEBUG_API === "1") {
    for (const pg of [customerPage, adminPage]) {
      pg.on("response", async (res) => {
        if (!res.url().includes("/v1/")) return;
        if (res.status() < 400) return;
        console.log("API!", res.request().method(), res.url(), res.status(), (await res.text().catch(() => "")).slice(0, 300));
      });
      pg.on("requestfailed", (req) => {
        if (req.url().includes("/v1/")) console.log("API-FAIL!", req.method(), req.url(), req.failure()?.errorText);
      });
    }
  }

  let completed = false;
  try {
    // 고객 팬은 완전 게스트로 시작 — 데모 스토어 세션 제거
    await customerPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await customerPage.evaluate(() => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lumina-db-") || k === "lumina-session" || k === "lumina-intake-draft")
        .forEach((k) => localStorage.removeItem(k));
    });

    // ───── ACT 0 · 어드민: 게이트 로그인 → 실주문 콘솔 대기 ─────
    await go("admin", "/gate-7f3k9x", "Staff sign-in — the private admin gate");
    await fillField("admin", adminPage.getByRole("textbox", { name: /email/i }), ADMIN.email);
    await fillField("admin", adminPage.getByRole("textbox", { name: /password/i }), ADMIN.password);
    await tap("admin", adminPage.locator("main").getByRole("button", { name: /^Sign in$/i }));
    await adminPage.waitForURL(`**${ADMIN_BASE}/live`, { timeout: 15000 });
    await banner(adminPage, "admin", "Live orders — waiting for new requests");
    await wait(1600);

    // ───── ACT 1 · 고객: 홈 → 커스텀 요청 위저드 ─────
    await go("customer", "/", "A new customer lands on the homepage");
    await wait(2200);
    await tap("customer", customerPage.locator('main a[href*="/custom/new"]').first());
    await banner(customerPage, "customer", "Custom request — piece, design, metal, stone");
    await wait(500);

    await tap("customer", customerPage.getByRole("option", { name: /^Ring/ }));
    await tap("customer", customerPage.getByRole("option", { name: /Four-Prong Solitaire Ring/i }));
    await tap("customer", customerPage.getByRole("option", { name: /18K White Gold/i }));
    await tap("customer", customerPage.getByRole("option", { name: /^Round/ }));
    // 캐럿: 추천 기본값 유지
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /^Next$/i }));

    // 영감 사진 업로드 — R2 직행 업로드가 끝날 때까지 대기
    await banner(customerPage, "customer", "Attach an inspiration photo");
    await point("customer", customerPage.locator("main .drop-zone").first());
    await customerPage.locator('main input[type="file"]').first().setInputFiles([ASSET("lineup-ring.png")]);
    await customerPage.locator("main .picker-list-item").first().waitFor({ timeout: 15000 });
    await wait(2600);
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /^Next$/i }));

    // 연락처 — 확정 제안이 도착할 곳
    await banner(customerPage, "customer", "Where should the proposal arrive?");
    await fillField("customer", customerPage.locator(".gflow-contact input").nth(0), CUSTOMER.name);
    await fillField("customer", customerPage.locator(".gflow-contact input").nth(1), CUSTOMER.email);
    await tap("customer", customerPage.locator(".gflow-contact").getByRole("button", { name: /^Next$/i }));

    // 리뷰: 링 사이즈 → 약관 동의 → 제출
    await banner(customerPage, "customer", "Review & submit the request");
    await tap("customer", customerPage.locator("#gflow-size-fit .lux-select-trigger").first());
    await tap("customer", customerPage.locator(".lux-select-option-button", { hasText: /^US 6$/ }));
    await tap("customer", customerPage.locator('main input[type="checkbox"]'));
    await tap("customer", customerPage.locator(".gflow-submit"));

    // 접수 확인 — 실서버 주문번호(BD-) 승격 대기
    await customerPage.getByText(/^BD-\d+/).first().waitFor({ timeout: 20000 });
    const orderCode = (await customerPage.getByText(/^BD-\d+/).first().textContent()).trim();
    await banner(customerPage, "customer", `Request received — order ${orderCode}`);
    log(`live order created: ${orderCode}`);
    await wait(2800);

    // ───── ACT 2 · 고객: 포털 진입 — 이메일 인증(OTP) ─────
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /open my order page/i }));
    await banner(customerPage, "customer", "The portal is private — sign in with your email");
    await wait(1200);
    await tap("customer", customerPage.locator("main").getByRole("link", { name: /sign in/i }).first());
    await fillField("customer", customerPage.locator('main input[type="email"], main .field input').first(), CUSTOMER.email);
    const codeResponse = customerPage.waitForResponse((res) =>
      res.url().includes("/v1/auth/code") && res.request().method() === "POST" && res.status() < 400,
      { timeout: 15000 },
    );
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /email me a code/i }));
    const devCode = (await (await codeResponse).json())?.devCode;
    if (!/^\d{6}$/.test(devCode || "")) throw new Error("dev OTP code not returned to recorder");
    await banner(customerPage, "customer", "Enter the 6-digit code from the email");
    await fillField("customer", customerPage.locator(".otp-input"), devCode);
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /^Sign in$/i }));
    await customerPage.locator(".client-portal-page").waitFor({ timeout: 15000 });
    await banner(customerPage, "customer", "Your order home — we are preparing the proposal");
    await wait(2600);

    // ───── ACT 3 · 어드민: 새 주문 → 제안 컴포저 → 발송 ─────
    await go("admin", `${ADMIN_BASE}/live`, "A new live order just arrived");
    await tap("admin", adminPage.locator(`.data-table tr:has-text("${orderCode}")`).first());
    await adminPage.locator(".client-stage-section").first().waitFor({ timeout: 15000 });
    await banner(adminPage, "admin", "Compose the proposal — setting, stone, price, timeline");
    await wait(1400);
    await point("admin", activeStep());
    await fillField("admin", activeStep().locator('label:has-text("Design adjustment note") input'), "Basket lowered slightly per your inspiration photo.");
    await fillField("admin", activeStep().locator('label:has-text("Total ($)") input'), "4800");
    await banner(adminPage, "admin", "Send the proposal — the customer is emailed in their language");
    await adminSend(/^Send proposal to customer$/, "Deposit received");

    // ───── ACT 4 · 고객: 제안 검토 → 수정 요청 ─────
    await go("customer", `/orders/${orderCode}`, "The proposal is in — review every detail", { waitFor: ".client-portal-page" });
    await point("customer", customerPage.locator("#bd-proposal .proposal-total").first());
    await wait(2600);
    await banner(customerPage, "customer", "One tweak first — request a change");
    await tap("customer", customerPage.locator("#bd-proposal").getByRole("button", { name: /request changes/i }));
    await fillField("customer", customerPage.locator("#bd-proposal textarea"),
      "Love it — could the band be slightly thinner (about 1.8mm)? And is a hidden halo possible within budget?");
    await tap("customer", customerPage.locator("#bd-proposal").getByRole("button", { name: /send request|request changes|send/i }).first());
    await wait(1800);

    // ───── ACT 5 · 어드민: 수정 요청 반영 → 수정 제안 재발송 ─────
    await go("admin", `${ADMIN_BASE}/live/${orderCode}`, "Customer requested changes — revise the proposal", { waitFor: ".client-stage-section" });
    await point("admin", adminPage.locator(".feedback-note").first());
    await wait(2000);
    await fillField("admin", activeStep().locator('label:has-text("Design adjustment note") input'),
      "Band slimmed to 1.8mm + hidden halo added. Total updated.");
    await fillField("admin", activeStep().locator('label:has-text("Total ($)") input'), "4950");
    await banner(adminPage, "admin", "Send the revised proposal");
    await adminSend(/revised proposal/i, "Deposit received");

    // ───── ACT 6 · 고객: 수정본 승인 → 배송지 → 디파짓 ─────
    await go("customer", `/orders/${orderCode}`, "The revised proposal — approve it", { waitFor: ".client-portal-page" });
    await point("customer", customerPage.locator("#bd-proposal .proposal-total").first());
    await wait(2200);
    await tap("customer", customerPage.locator("#bd-proposal").getByRole("button", { name: /^Approve$/i }));
    await wait(1600);
    await banner(customerPage, "customer", "Confirm the insured shipping address");
    const addr = customerPage.locator("#bd-deposit .shipping-address-card input");
    await fillField("customer", addr.nth(0), "Jiwon Kim");
    await fillField("customer", addr.nth(1), "+1 213-555-0100");
    await fillField("customer", addr.nth(2), "550 S Hill St");
    await fillField("customer", addr.nth(4), "Los Angeles");
    await fillField("customer", addr.nth(5), "CA");
    await fillField("customer", addr.nth(6), "90013");
    await fillField("customer", addr.nth(7), "USA");
    await tap("customer", customerPage.locator("#bd-deposit .shipping-address-card").getByRole("button").last());
    await wait(1000);
    await banner(customerPage, "customer", "Send the deposit via Zelle/Venmo & report it");
    await point("customer", customerPage.locator("#bd-deposit .payment-pilot-note"));
    await tap("customer", customerPage.locator("#bd-deposit .payment-sent"));
    await wait(1800);

    // ───── ACT 7 · 어드민: 디파짓 확인 → 다이아 확보 → 제작 시작 ─────
    await go("admin", `${ADMIN_BASE}/live/${orderCode}`, "Touchpoint — confirm the deposit", { waitFor: ".client-stage-section" });
    await adminSend(/^Confirm deposit received$/, "Diamond secured");
    await banner(adminPage, "admin", "Diamond secured — IGI number on file");
    await fillField("admin", activeStep().locator('label:has-text("IGI No.") input'), "IGI 625437890");
    await adminSend(/^Confirm diamond secured$/, "Production started");
    await banner(adminPage, "admin", "Production started at the atelier");
    await adminSend(/^Start production$/, "Send finished-piece QC");

    // ───── ACT 8 · 어드민: 완성품 QC 발송 ─────
    await banner(adminPage, "admin", "The piece is finished — send QC for confirmation");
    await point("admin", activeStep().locator(".drop-zone").first());
    await activeStep().locator('input[type="file"]').first().setInputFiles([ASSET("hero-diamond-ring.png"), ASSET("lineup-ring.png")]);
    await activeStep().locator(".picker-list-item").first().waitFor({ timeout: 15000 });
    await wait(3200);
    await fillField("admin", activeStep().locator('label:has-text("Customer note") input'),
      "Final QC passed — photos, IGI certificate, and measured weight attached.");
    await adminSend(/^Send finished-piece QC$/, "Request the balance");

    // ───── ACT 9 · 고객: 완성품 컨펌 ─────
    await go("customer", `/orders/${orderCode}`, "Your finished piece — confirm it", { waitFor: ".client-portal-page" });
    await point("customer", customerPage.locator("#bd-action").first());
    await wait(2400);
    await tap("customer", customerPage.locator("#bd-action").getByRole("button", { name: /^Confirm$/i }));
    await wait(1600);

    // ───── ACT 10 · 잔금: 요청 → 송금 보고 → 확인 ─────
    await go("admin", `${ADMIN_BASE}/live/${orderCode}`, "Request the balance", { waitFor: ".client-stage-section" });
    await adminSend(/^Request balance payment$/, "Balance received");
    await go("customer", `/orders/${orderCode}`, "Send the balance & report it", { waitFor: ".client-portal-page" });
    await point("customer", customerPage.locator("#bd-balance").first());
    await tap("customer", customerPage.locator("#bd-balance .payment-sent"));
    await wait(1500);
    await go("admin", `${ADMIN_BASE}/live/${orderCode}`, "Touchpoint — confirm the balance", { waitFor: ".client-stage-section" });
    await adminSend(/^Confirm balance received$/, "Shipped");

    // ───── ACT 11 · 배송 → 수령 ─────
    await banner(adminPage, "admin", "Shipped — insured, tracking number attached");
    await fillField("admin", activeStep().locator('label:has-text("Tracking no.") input'), "1Z-BELOVED-88234901");
    await adminSend(/^Confirm shipment and email tracking$/, "Delivered");
    await go("customer", `/orders/${orderCode}`, "On its way — tracking number in your portal", { waitFor: ".client-portal-page" });
    await point("customer", customerPage.locator("#bd-shipment .payment-memo-pill").first());
    await wait(2600);
    await go("admin", `${ADMIN_BASE}/live/${orderCode}`, "Package received — mark delivered", { waitFor: ".client-stage-section" });
    await adminSend(/^Mark order delivered$/);

    // ───── 피날레 ─────
    await go("customer", `/orders/${orderCode}`, "Delivered ✓ — the piece is home", { waitFor: ".client-portal-page" });
    await wait(3000);
    await go("admin", `${ADMIN_BASE}/live/${orderCode}`, "Order delivered ✓ — full journey complete", { waitFor: ".client-stage-section" });
    await wait(3200);

    completed = true;
    console.log(`Live order flow recorded for ${orderCode}`);
  } catch (error) {
    console.error("Demo recording failed:", error.message.split("\n")[0]);
    try { await customerPage.screenshot({ path: `${OUT_DIR}/live-error-customer.png`, fullPage: true }); } catch {}
    try { await adminPage.screenshot({ path: `${OUT_DIR}/live-error-admin.png`, fullPage: true }); } catch {}
    throw error;
  } finally {
    if (DRY) {
      await browser.close();
    } else {
      const customerVideo = await customerPage.video();
      const adminVideo = await adminPage.video();
      await Promise.allSettled([customerPage.context().close(), adminPage.context().close()]);
      const [customerPath, adminPath] = await Promise.all([
        customerVideo ? customerVideo.path().catch(() => null) : Promise.resolve(null),
        adminVideo ? adminVideo.path().catch(() => null) : Promise.resolve(null),
      ]);
      await browser.close().catch(() => {});
      if (completed) {
        if (!customerPath || !adminPath) throw new Error("recording completed without both video streams");
        execFileSync("ffmpeg", [
          "-y",
          "-i", customerPath,
          "-i", adminPath,
          "-filter_complex", "[0:v]trim=start=0.6,setpts=PTS-STARTPTS[v0];[1:v]trim=start=0.6,setpts=PTS-STARTPTS[v1];[v0][v1]hstack=inputs=2,format=yuv420p[v]",
          "-map", "[v]",
          "-r", "25",
          "-c:v", "libx264",
          "-preset", "medium",
          "-crf", String(VIDEO_CRF),
          "-movflags", "+faststart",
          OUT_FILE,
        ], { stdio: "ignore" });
        console.log(`Video written: ${OUT_FILE}`);
      } else {
        await rm(OUT_FILE, { force: true });
      }
      await Promise.allSettled([customerPath && unlink(customerPath), adminPath && unlink(adminPath)].filter(Boolean));
    }
  }
}

main();
