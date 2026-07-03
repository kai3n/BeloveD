// Full end-to-end order journey recording — homepage → custom request wizard →
// admin proposal → customer accept + deposit → design approval → finished-piece
// QC → balance → shipping → delivered. Two panes (customer left, admin right).
//
// Usage: with the Vite dev server running (npm run dev):
//   node scripts/demo-e2e-full-record.mjs          # records demo-video/full-e2e-order-flow-en.mp4
//   DRY=1 node scripts/demo-e2e-full-record.mjs    # fast headless dry-run, no video
//
// 데모 스토어(localStorage) 기준 — API 서버 불필요 (미디어 업로드는 base64 폴백).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const DRY = process.env.DRY === "1";
const BASE = process.env.DEMO_BASE_URL || "http://127.0.0.1:5173";
const OUT_DIR = "demo-video";
const OUT_FILE = `${OUT_DIR}/full-e2e-order-flow-en.mp4`;
const PANE = { width: 900, height: 820 };
const LANG = "en";
const THEME = "day";
const USERS = { customer: "u-customer", admin: "u-admin" };
const ASSET = (name) => new URL(`../public/assets/${name}`, import.meta.url).pathname;

const ROLE_STYLE = {
  customer: { bg: "#1f6f43", label: "CUSTOMER · Jiwon Kim" },
  admin: { bg: "#8a5a1e", label: "ADMIN · BeloveD order control" },
};

let customerPage;
let adminPage;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, DRY ? Math.min(ms, 120) : ms));
const paneOf = (role) => (role === "customer" ? customerPage : adminPage);
const log = (msg) => console.log(`  · ${msg}`);

const CURSOR_INIT = () => {
  function ensureCursor() {
    const existing = document.getElementById("demo-cursor");
    if (existing) return existing;
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:40%",
      "width:24px",
      "height:24px",
      "border-radius:50%",
      "border:2px solid #fff",
      "background:rgba(255,255,255,.25)",
      "box-shadow:0 0 0 2px rgba(0,0,0,.45),0 3px 10px rgba(0,0,0,.45)",
      "z-index:2147483647",
      "pointer-events:none",
      "transform:translate(-50%,-50%)",
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
      "position:fixed",
      `left:${x}px`,
      `top:${y}px`,
      "width:16px",
      "height:16px",
      "border-radius:50%",
      "background:rgba(255,205,110,.88)",
      "z-index:2147483646",
      "pointer-events:none",
      "transform:translate(-50%,-50%)",
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
      "position:fixed",
      `left:${x}px`,
      `top:${y}px`,
      `width:${width}px`,
      `height:${height}px`,
      "border:2.5px solid #ffcd6e",
      "border-radius:7px",
      "box-shadow:0 0 0 3px rgba(255,205,110,.28)",
      "background:rgba(255,205,110,.12)",
      "z-index:2147483645",
      "pointer-events:none",
      "transition:opacity .42s",
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
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:2147483640",
      `background:${bg}`,
      "color:#fff",
      "font:600 15px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "padding:10px 18px",
      "display:flex",
      "justify-content:space-between",
      "align-items:center",
      "box-shadow:0 2px 12px rgba(0,0,0,.22)",
    ].join(";");
    bannerEl.innerHTML = `<span>${label}</span><span style="opacity:.86;font-weight:500">${stepText}</span>`;
    document.body.appendChild(bannerEl);
    document.body.style.paddingTop = "44px";
  }, { ...style, stepText: step });
}

async function setRole(role) {
  const page = paneOf(role);
  await page.evaluate((userId) => localStorage.setItem("lumina-session", userId), USERS[role]);
}

async function go(role, path, step) {
  const page = paneOf(role);
  if (!page.url().startsWith(BASE)) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await setRole(role);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (path.startsWith("/orders/")) {
    await page.locator(".client-portal-page").waitFor({ state: "visible", timeout: 10000 });
  }
  if (path.startsWith("/admin/orders/")) {
    await page.locator(".ops-order-page").waitFor({ state: "visible", timeout: 10000 });
  }
  await banner(page, role, step);
  await page.bringToFront();
  await wait(850);
  log(`[${role}] ${path} — ${step}`);
}

async function point(role, locator) {
  const page = paneOf(role);
  await locator.waitFor({ state: "visible", timeout: 8000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return null;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.evaluate(({ x, y, bx, by, w, h }) => {
    window.__demoCursorMove(x, y);
    window.__demoHighlight(bx, by, w, h);
  }, { x: cx, y: cy, bx: box.x, by: box.y, w: box.width, h: box.height });
  await wait(420);
  return { x: cx, y: cy };
}

async function tap(role, locator) {
  const page = paneOf(role);
  const loc = locator.first();
  const p = await point(role, loc);
  if (p) await page.evaluate(({ x, y }) => window.__demoCursorClick(x, y), p);
  await wait(160);
  await loc.click();
  await wait(760);
}

async function fillField(role, locator, value) {
  const loc = locator.first();
  await point(role, loc);
  await loc.fill(value);
  await wait(320);
}

async function storeEval(page, fn, arg = {}) {
  return page.evaluate(async ({ source, input }) => {
    const store = await import("/src/lib/store.js");
    return (0, eval)(`(${source})`)(store, input);
  }, { source: fn.toString(), input: arg });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: PANE,
    ...(DRY ? {} : { recordVideo: { dir: OUT_DIR, size: PANE } }),
  });
  await context.addInitScript(({ lang, theme }) => {
    localStorage.setItem("lumina-locale", lang);
    localStorage.setItem("lumina-theme", theme);
  }, { lang: LANG, theme: THEME });
  await context.addInitScript(CURSOR_INIT);

  customerPage = await context.newPage();
  adminPage = await context.newPage();

  try {
    // 데모 DB·세션·드래프트 완전 초기화 — 항상 같은 시작점에서 녹화
    await customerPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await customerPage.evaluate(() => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lumina-db-") || k === "lumina-session" || k === "lumina-intake-draft")
        .forEach((k) => localStorage.removeItem(k));
    });

    // 어드민 패널은 주문 목록을 띄워둔 채 대기 — 오른쪽 패널이 빈 화면으로 시작하지 않게
    await go("admin", "/admin/orders", "Order control — waiting for new requests");

    // ───── ACT 1 · 고객: 홈 → 커스텀 요청 위저드 ─────
    await go("customer", "/", "A new customer lands on the homepage");
    await wait(2000);
    await tap("customer", customerPage.getByRole("link", { name: /Begin your piece/i }));
    await banner(customerPage, "customer", "Custom request — piece, design, metal, stone");
    await wait(400);

    await tap("customer", customerPage.getByRole("option", { name: /^Ring/ }));
    await tap("customer", customerPage.getByRole("option", { name: /Four-Prong Solitaire Ring/i }));
    await tap("customer", customerPage.getByRole("option", { name: /18K White Gold/i }));
    await tap("customer", customerPage.getByRole("option", { name: /^Round/ }));
    // 캐럿: 추천 기본값 1.5ct 유지
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /^Next$/i }));

    // 영감 사진 업로드
    await banner(customerPage, "customer", "Attach inspiration photos");
    const wizardInput = customerPage.locator('main input[type="file"]').first();
    await point("customer", customerPage.locator("main .drop-zone").first());
    await wizardInput.setInputFiles([ASSET("lineup-ring.png")]);
    await customerPage.locator("main .picker-list-item").first().waitFor({ timeout: 10000 });
    await wait(700);
    await tap("customer", customerPage.locator("main").getByRole("button", { name: /^Next$/i }));

    // 리뷰: 링 사이즈 → 약관 동의 → 제출
    await banner(customerPage, "customer", "Review & submit the request");
    await tap("customer", customerPage.locator("#gflow-size-fit .lux-select-trigger").first());
    await tap("customer", customerPage.locator(".lux-select-option-button", { hasText: /^US 6$/ }));
    await tap("customer", customerPage.locator('main input[type="checkbox"]'));
    await tap("customer", customerPage.locator(".gflow-submit"));

    // 접수 확인 화면 — 주문 ID·조회 코드
    await customerPage.getByText(/Request received/i).first().waitFor({ timeout: 10000 });
    await banner(customerPage, "customer", "Request received — order ID & private code issued");
    const { orderId, queryCode } = await storeEval(customerPage, (store) => {
      const order = store.listOpsOrders()[0];
      return { orderId: order.id, queryCode: order.queryCode };
    });
    log(`order created: ${orderId} (${queryCode})`);
    await wait(3000);

    // ───── ACT 2 · 어드민: 새 요청 확인 → 제품 초안 구성 → 발송 ─────
    await go("admin", `/admin/orders/${orderId}`, "New request in — auto-matched stones ready");
    await wait(900);
    // 자동 매칭된 후보 중 추천 스톤을 제안 스톤으로 지정 → 견적 초안 자동 생성
    await tap("admin", adminPage.getByRole("button", { name: /Use for proposal/i }));
    await banner(adminPage, "admin", "Compose the product draft — design, setting, stone, timeline");
    // 제품 초안 컴포저: 디자인 미디어는 카탈로그 렌더로 프리필 — 세팅 노트만 손보고 발송
    await fillField("admin", adminPage.locator(".ops-proposal-composer input[placeholder*='Basket'], .ops-proposal-composer input[placeholder*='reference']").first(),
      "Basket lowered slightly per your inspiration photo.");
    await tap("admin", adminPage.getByRole("button", { name: /Send proposal to customer/i }));
    await banner(adminPage, "admin", "Product draft sent — design + stone + price in one proposal");
    await wait(1500);

    // ───── ACT 3 · 고객: 초안(확정 제안) 검토 → 배송지 → 수락 → 디파짓 ─────
    await go("customer", `/orders/${orderId}?code=${queryCode}`, "The proposal draft is in — review it");
    await point("customer", customerPage.locator(".proposal-card").first());
    await wait(2200);
    const addr = customerPage.locator(".shipping-address-card input");
    await banner(customerPage, "customer", "Confirm shipping address");
    await fillField("customer", addr.nth(0), "Jiwon Kim");
    await fillField("customer", addr.nth(1), "+1 213-555-0100");
    await fillField("customer", addr.nth(2), "550 S Hill St");
    await fillField("customer", addr.nth(4), "Los Angeles");
    await fillField("customer", addr.nth(5), "CA");
    await fillField("customer", addr.nth(6), "90013");
    await fillField("customer", addr.nth(7), "USA");
    await banner(customerPage, "customer", "Accept the proposal");
    await tap("customer", customerPage.locator(".proposal-confirm"));
    await wait(900);
    await banner(customerPage, "customer", "Send the deposit & report it");
    await tap("customer", customerPage.locator("#pay-stage .payment-sent"));
    await wait(1200);

    // ───── ACT 4 · 어드민: 디파짓 수령 확인 → 제작 자동 진행 ─────
    await go("admin", `/admin/orders/${orderId}`, "Touchpoint 1 — confirm the deposit");
    await tap("admin", adminPage.getByRole("button", { name: /Deposit received/i }));
    await wait(1200);

    // 디자인 승인 스텝 없음 — 초안 수락이 디자인 승인을 겸한다. 벤더 CAD는 기록으로만.
    await banner(adminPage, "admin", "Vendor CAD recorded — production started (design approved with the draft)");
    await storeEval(adminPage, (store, { id }) => {
      const pr = store.listProcurements({ orderId: id })
        .find((item) => item.type === "cad" && item.status === "open");
      if (!pr) throw new Error("open cad procurement missing");
      store.submitCadForPr(pr.id, "/assets/lineup-ring.png");
    }, { id: orderId });
    await wait(1600);

    // ───── ACT 5 · 어드민: 완성품 QC 발송 → 고객 최종 컨펌 ─────
    await go("admin", `/admin/orders/${orderId}`, "Finished piece — send QC for final confirmation");
    const proxyEditor = adminPage.locator(".ops-proxy-editor");
    await point("admin", proxyEditor.locator(".drop-zone").first());
    await proxyEditor.locator('input[type="file"]').first().setInputFiles([ASSET("hero-diamond-ring.png"), ASSET("lineup-ring.png")]);
    await proxyEditor.locator(".picker-list-item").first().waitFor({ timeout: 10000 });
    await wait(650);
    await fillField("admin", proxyEditor.locator("textarea"), "Final QC photos, certificate, and measured weight are ready.");
    await tap("admin", adminPage.getByRole("button", { name: /Send finished piece/i }));
    await wait(1000);

    await go("customer", `/orders/${orderId}?code=${queryCode}`, "The finished piece — confirm it");
    await point("customer", customerPage.locator("#final-stage").first());
    await tap("customer", customerPage.locator("#final-stage .customer-decision-actions .button.primary"));
    await wait(1200);

    // ───── ACT 7 · 고객 잔금 → 어드민 확인 → 배송 → 수령 ─────
    await banner(customerPage, "customer", "Send the balance & report it");
    await tap("customer", customerPage.locator("#balance-stage .payment-sent"));
    await wait(1000);

    await go("admin", `/admin/orders/${orderId}`, "Touchpoint 2 — confirm the balance");
    await tap("admin", adminPage.getByRole("button", { name: /Balance received/i }));
    await wait(1000);

    await banner(adminPage, "admin", "Vendor shipped — tracking number uploaded");
    await storeEval(adminPage, (store, { id }) => {
      const pr = store.listProcurements({ orderId: id })
        .find((item) => item.type === "ship" && item.status === "open");
      if (!pr) throw new Error("open ship procurement missing");
      store.submitShipment(pr.id, { trackingNo: "1Z-BELOVED-88234901", shippedAt: "2026-08-28" });
    }, { id: orderId });
    await wait(1100);

    await go("admin", `/admin/orders/${orderId}`, "Touchpoint 3 — package received, mark delivered");
    await tap("admin", adminPage.getByRole("button", { name: /mark delivered/i }));
    await wait(1000);

    // ───── ACT 8 · 피날레: 양쪽 모두 Delivered ─────
    await go("customer", `/orders/${orderId}?code=${queryCode}`, "Delivered ✓ — the piece is home");
    await wait(2500);
    await go("admin", `/admin/orders/${orderId}`, "Order delivered ✓ — full journey complete");
    await wait(3000);

    console.log(`Full e2e order flow recorded for ${orderId}`);
  } catch (error) {
    console.error("Demo recording failed:", error.message.split("\n")[0]);
    try { await customerPage.screenshot({ path: `${OUT_DIR}/e2e-error-customer.png`, fullPage: true }); } catch {}
    try { await adminPage.screenshot({ path: `${OUT_DIR}/e2e-error-admin.png`, fullPage: true }); } catch {}
    throw error;
  } finally {
    if (DRY) {
      await context.close();
      await browser.close();
    } else {
      const customerVideo = await customerPage.video();
      const adminVideo = await adminPage.video();
      await context.close();
      const customerPath = await customerVideo.path();
      const adminPath = await adminVideo.path();
      await browser.close();
      execFileSync("ffmpeg", [
        "-y",
        "-i", customerPath,
        "-i", adminPath,
        "-filter_complex", "[0:v][1:v]hstack=inputs=2,format=yuv420p[v]",
        "-map", "[v]",
        "-r", "25",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "22",
        "-movflags", "+faststart",
        OUT_FILE,
      ], { stdio: "ignore" });
      // 중간 산출물(webm) 정리 — 합성 mp4만 남긴다
      const { unlink } = await import("node:fs/promises");
      await Promise.allSettled([unlink(customerPath), unlink(adminPath)]);
      console.log(`Video written: ${OUT_FILE}`);
    }
  }
}

main();
