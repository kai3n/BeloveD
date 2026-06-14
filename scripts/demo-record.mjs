// 전 과정(주문→풀 매칭→재고확인→락→견적→CAD→QC→배송완료) 자동 클릭·녹화.
// 좌(고객·녹색)/우(공방·파랑 / 운영·주황) 2탭 분할, 영어, 느린 속도, 가짜 커서·하이라이트.
// 사용법: dev 서버(http://localhost:5173) 띄운 상태에서  node scripts/demo-record.mjs
// 결과: demo-video/demo-en.mp4 (좌우 hstack 합성)
//
// 한 컨텍스트의 두 탭이 localStorage DB를 공유한다(AuthProvider는 전체 로드 시에만 세션을 읽음).
// 매 goto 직전 세션을 해당 역할로 세팅 → 순차 동작이라 충돌 없음. Order ID·PR은 DB에서 동적 캡처.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:5173";
const OUT = "demo-video";
const PANE = { width: 900, height: 820 };
const LANG = "en";
const SLOW = 1.5;
const ASSET = (name) => new URL(`../public/assets/${name}`, import.meta.url).pathname;

const USERS = { customer: "u-customer", supplier: "u-supplier1", admin: "u-admin" };
const ROLE_STYLE = {
  customer: { bg: "#1f6f43", label: "CUSTOMER · Jiwon Kim" },
  supplier: { bg: "#1e4f8a", label: "WORKSHOP · Vendor SUPPLIER-CN-01" },
  admin: { bg: "#8a5a1e", label: "OPERATIONS · LUMINA LAB" },
};

let left, right;
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SLOW));
const paneOf = (role) => (role === "customer" ? left : right);

const CURSOR_INIT = () => {
  function ensure() {
    if (document.getElementById("demo-cursor")) return document.getElementById("demo-cursor");
    const c = document.createElement("div");
    c.id = "demo-cursor";
    c.style.cssText = "position:fixed;left:50%;top:40%;width:26px;height:26px;border-radius:50%;border:2px solid #fff;background:rgba(255,255,255,.25);box-shadow:0 0 0 2px rgba(0,0,0,.45),0 3px 10px rgba(0,0,0,.6);z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1)";
    (document.body || document.documentElement).appendChild(c);
    return c;
  }
  window.__cursorMove = (x, y) => { const c = ensure(); c.style.left = x + "px"; c.style.top = y + "px"; };
  window.__cursorClick = (x, y) => {
    ensure();
    const r = document.createElement("div");
    r.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:16px;height:16px;border-radius:50%;background:rgba(255,205,110,.85);z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%)`;
    (document.body || document.documentElement).appendChild(r);
    r.animate([{ opacity: .9, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(4.5)" }], { duration: 620, easing: "ease-out" });
    setTimeout(() => r.remove(), 640);
  };
  window.__highlight = (x, y, w, h) => {
    const b = document.createElement("div");
    b.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:2.5px solid #ffcd6e;border-radius:7px;box-shadow:0 0 0 3px rgba(255,205,110,.3);background:rgba(255,205,110,.12);z-index:2147483645;pointer-events:none;transition:opacity .45s`;
    (document.body || document.documentElement).appendChild(b);
    setTimeout(() => { b.style.opacity = "0"; setTimeout(() => b.remove(), 450); }, 1000);
  };
};

async function banner(pane, role, step) {
  const s = ROLE_STYLE[role];
  await pane.evaluate(({ bg, label, step }) => {
    document.getElementById("demo-banner")?.remove();
    const el = document.createElement("div");
    el.id = "demo-banner";
    el.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:2147483640;background:${bg};color:#fff;font:600 15px/1.4 -apple-system,system-ui,sans-serif;padding:10px 18px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,.4)`;
    el.innerHTML = `<span>${label}</span><span style="opacity:.85;font-weight:500">${step}</span>`;
    document.body.appendChild(el);
    document.body.style.paddingTop = "44px";
  }, { ...s, step });
}

async function setRole(role) {
  await paneOf(role).evaluate((id) => localStorage.setItem("lumina-session", id), USERS[role]);
}

async function go(role, path, step) {
  const pane = paneOf(role);
  if (!pane.url().startsWith(BASE)) await pane.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await setRole(role);
  await pane.goto(BASE + path, { waitUntil: "networkidle" });
  await banner(pane, role, step);
  await pane.bringToFront();
  await wait(1200);
}

async function point(role, locator) {
  const pane = paneOf(role);
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return null;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await pane.evaluate(({ x, y, bx, by, w, h }) => { window.__cursorMove(x, y); window.__highlight(bx, by, w, h); },
    { x: cx, y: cy, bx: box.x, by: box.y, w: box.width, h: box.height });
  await wait(600);
  return { cx, cy };
}
async function tap(role, locator) {
  const pane = paneOf(role);
  const p = await point(role, locator);
  if (p) await pane.evaluate(({ x, y }) => window.__cursorClick(x, y), { x: p.cx, y: p.cy });
  await wait(200);
  await locator.click();
  await wait(1000);
}
async function clickName(role, name, opts = {}) {
  await tap(role, paneOf(role).getByRole("button", { name, ...opts }).first());
}
async function fill(role, roleType, name, val) {
  const loc = paneOf(role).getByRole(roleType, { name }).first();
  await point(role, loc);
  await loc.fill(val);
  await wait(500);
}
async function picks(role, gridIndex, cells = [0]) {
  const grid = paneOf(role).locator(".picker-samples-grid").nth(gridIndex);
  for (const i of cells) await tap(role, grid.locator("button.picker-cell").nth(i));
}
async function upload(role, dropIndex, file) {
  const pane = paneOf(role);
  await point(role, pane.locator(".drop-zone").nth(dropIndex));
  await pane.locator(".drop-zone input[type=file]").nth(dropIndex).setInputFiles(ASSET(file));
  await wait(1000);
}
// 공급자 큐에서 특정 타입의 열린 PR id를 DB에서 찾는다 (하드코딩 없이 동적)
async function openPrId(type) {
  return right.evaluate((t) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("lumina-db-"));
    const db = JSON.parse(localStorage.getItem(key));
    const pr = db.procurementReqs.filter((p) => p.type === t && p.status === "open").sort((a, b) => b.id.localeCompare(a.id))[0];
    return pr ? pr.id : null;
  }, type);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: PANE, recordVideo: { dir: OUT, size: PANE } });
  await context.addInitScript((lang) => localStorage.setItem("lumina-locale", lang), LANG);
  await context.addInitScript(CURSOR_INIT);
  left = await context.newPage();
  right = await context.newPage();

  let orderId = "DM-000009", code = "";
  try {
    await go("customer", "/", "Browsing LUMINA LAB");
    await go("supplier", "/supplier", "Vendor task queue (waiting)");

    // 1. 고객: 3단계 위저드로 주문
    await go("customer", "/custom/new", "Step 1 — New custom order");
    await left.locator('select:has(option[value="RING-001"])').selectOption("RING-001");
    await wait(400);
    await fill("customer", "textbox", "Delivery country", "USA");
    await fill("customer", "textbox", "Ring size", "6 US");
    await clickName("customer", "Next");               // → center stone
    await wait(400);
    await clickName("customer", "Next");               // → references
    await tap("customer", left.locator(".picker-samples-grid button.picker-cell").nth(1)); // 레퍼런스 1장
    await tap("customer", left.getByRole("checkbox").first());
    await clickName("customer", "Submit request");
    await left.getByText(/DM-\d{6}/).first().waitFor();
    // 생성된 Order ID·코드 캡처
    const captured = await left.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("lumina-db-"));
      const db = JSON.parse(localStorage.getItem(key));
      const o = db.opsOrders[db.opsOrders.length - 1];
      return { id: o.id, code: o.queryCode };
    });
    orderId = captured.id; code = captured.code;
    await banner(left, "customer", `Order ${orderId} created`);
    await wait(2000);

    // 2. 고객: 풀 자동매칭 후보에서 찜 → 재고확인 요청
    await go("customer", `/track/${orderId}?code=${code}`, "Step 2 — Auto-matched stones · shortlist");
    await clickName("customer", "Shortlist");
    await clickName("customer", "Request stock check");

    // 3. 벤더: 매직링크 로그인 → 재고확인
    await go("supplier", "/supplier", "Step 3 — Workshop magic-link sign-in");
    const scPr = await openPrId("stockConfirm");
    await go("supplier", `/supplier/tasks/${scPr}`, "Step 3 — Confirm stock");
    await clickName("supplier", "In stock");

    // 4. 고객: 스톤 락 → 자동 견적 → 수락
    await go("customer", `/track/${orderId}?code=${code}`, "Step 4 — Lock the stone (auto quote)");
    await clickName("customer", "Choose this one");
    await go("customer", `/track/${orderId}?code=${code}`, "Step 4 — Accept the quote");
    await clickName("customer", "Accept quote");

    // 5. 운영자 ①: 디파짓 확인 → CAD 태스크 자동 발행
    await go("admin", `/admin/ops/${orderId}`, "Touchpoint ① — Confirm deposit");
    await clickName("admin", "Deposit received");

    // 6. 벤더: CAD 드래그&드롭 업로드
    const cadPr = await openPrId("cad");
    await go("supplier", `/supplier/tasks/${cadPr}`, "Step 6 — Drag & drop CAD photos");
    await upload("supplier", 0, "lineup-ring.png");
    await upload("supplier", 1, "lineup-band.png");
    await clickName("supplier", "Submit", { exact: true });

    // 7. 고객: 디자인 승인 → 제작 시작 + QC 태스크 자동 발행
    await go("customer", `/track/${orderId}?code=${code}`, "Step 7 — Approve the design");
    await clickName("customer", "Approve");

    // 8. 벤더: 최종 QC 제출 → 실중량 자동 정산
    const qcPr = await openPrId("qc");
    await go("supplier", `/supplier/tasks/${qcPr}`, "Step 8 — Final QC + actual weight");
    await picks("supplier", 0, [6, 0]); // 영상 + 인증서
    await fill("supplier", "spinbutton", "Actual weight", "4.35");
    await clickName("supplier", "Submit", { exact: true });

    // 9. 고객: 완성품 최종 컨펌
    await go("customer", `/track/${orderId}?code=${code}`, "Step 9 — Confirm the finished piece");
    await wait(800);
    await clickName("customer", "Confirm");

    // 10. 운영자 ②: 잔금 확인 → 배송 태스크 자동 발행
    await go("admin", `/admin/ops/${orderId}`, "Touchpoint ② — Confirm balance → ship task");
    await clickName("admin", "Balance received");

    // 11. 벤더: 운송장 제출 → SHIPPING
    const shipPr = await openPrId("ship");
    await go("supplier", `/supplier/tasks/${shipPr}`, "Step 11 — Submit shipment");
    await fill("supplier", "textbox", "Tracking number", "1Z-LUMINA-88234901");
    await clickName("supplier", "Submit", { exact: true });

    // 12. 운영자 ③: 수령 확인 → 배송완료
    await go("admin", `/admin/ops/${orderId}`, "Touchpoint ③ — Mark received → delivered");
    await clickName("admin", "delivered");

    // 마무리: 양쪽 최종 상태
    await go("customer", `/track/${orderId}?code=${code}`, "Delivered ✓");
    await go("supplier", "/supplier", "All tasks submitted ✓");
    await wait(3000);

    console.log("✅ 전 과정 완료:", orderId);
  } catch (err) {
    console.error("⚠️ 중단:", err.message.split("\n")[0]);
    try { await left.screenshot({ path: `${OUT}/err-left.png` }); } catch {}
    try { await right.screenshot({ path: `${OUT}/err-right.png` }); } catch {}
  } finally {
    const lv = await left.video(), rv = await right.video();
    await context.close();
    const lpath = await lv.path(), rpath = await rv.path();
    await browser.close();
    const out = `${OUT}/demo-en.mp4`;
    try {
      execFileSync("ffmpeg", ["-y", "-i", lpath, "-i", rpath,
        "-filter_complex", "[0:v][1:v]hstack=inputs=2,format=yuv420p[v]",
        "-map", "[v]", "-movflags", "+faststart", out], { stdio: "ignore" });
      console.log("🎬 합성 영상:", out);
    } catch (e) { console.log("⚠️ ffmpeg 합성 실패:", lpath, rpath, e.message); }
  }
}

main();
