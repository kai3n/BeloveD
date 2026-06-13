// 전 과정(주문→벤더→고객→운영자) 자동 클릭·녹화 — 좌(고객)/우(공방·운영) 분할, 영어, 느린 속도.
// 커서·클릭 하이라이트 주입 (헤드리스 크로미움엔 실제 커서가 없으므로 가짜 커서+리플+요소 하이라이트).
// 사용법: dev 서버(http://localhost:5173) 띄운 상태에서  node scripts/demo-record.mjs
// 결과: demo-video/demo-en.mp4 (좌우 합성). 좌=CUSTOMER(녹색), 우=WORKSHOP(파랑)/OPERATIONS(주황).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:5173";
const OUT = "demo-video";
const PANE = { width: 900, height: 820 };
const LANG = "en";
const SLOW = 1.9; // 전체 속도 배수 (↑ 더 느리게)
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

// 커서·하이라이트·리플 유틸 (페이지 컨텍스트에 정의)
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

// 커서를 요소로 이동 + 박스 하이라이트
async function point(role, locator) {
  const pane = paneOf(role);
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return null;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await pane.evaluate(({ x, y, bx, by, w, h }) => { window.__cursorMove(x, y); window.__highlight(bx, by, w, h); },
    { x: cx, y: cy, bx: box.x, by: box.y, w: box.width, h: box.height });
  await wait(650);
  return { cx, cy };
}

// 커서 이동 → 리플 → 클릭
async function tap(role, locator) {
  const pane = paneOf(role);
  const p = await point(role, locator);
  if (p) await pane.evaluate(({ x, y }) => window.__cursorClick(x, y), { x: p.cx, y: p.cy });
  await wait(220);
  await locator.click();
  await wait(1100);
}

async function clickName(role, name, opts = {}) {
  await tap(role, paneOf(role).getByRole("button", { name, ...opts }).first());
}

async function fill(role, roleType, name, val) {
  const loc = paneOf(role).getByRole(roleType, { name }).first();
  const p = await point(role, loc);
  const pane = paneOf(role);
  if (p) await pane.evaluate(({ x, y }) => window.__cursorClick(x, y), { x: p.cx, y: p.cy });
  await loc.fill(val);
  await wait(650);
}

async function picks(role, gridIndex, cells = [0]) {
  const grid = paneOf(role).locator(".picker-samples-grid").nth(gridIndex);
  for (const i of cells) await tap(role, grid.locator("button.picker-cell").nth(i));
}

// 드래그&드롭 업로드 시연 — 드롭존으로 커서 이동 후 실제 파일을 숨은 input에 넣는다
async function upload(role, dropIndex, file) {
  const pane = paneOf(role);
  await point(role, pane.locator(".drop-zone").nth(dropIndex));
  await pane.locator(".drop-zone input[type=file]").nth(dropIndex).setInputFiles(ASSET(file));
  await wait(1100); // FileReader → 미리보기
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: PANE, recordVideo: { dir: OUT, size: PANE } });
  await context.addInitScript((lang) => localStorage.setItem("lumina-locale", lang), LANG);
  await context.addInitScript(CURSOR_INIT);

  left = await context.newPage();
  right = await context.newPage();

  try {
    await go("customer", "/", "Browsing LUMINA LAB");
    await go("supplier", "/supplier", "Vendor task queue (waiting)");

    // 1. 고객: 주문 제출
    await go("customer", "/custom/new", "Step 1 — Submit custom order");
    const styleSel = left.locator('select:has(option[value="RING-001"])');
    await point("customer", styleSel);
    await styleSel.selectOption("RING-001");
    await wait(600);
    await fill("customer", "textbox", "Ring size", "6 US");
    await fill("customer", "textbox", "Delivery country", "USA");
    await tap("customer", left.locator(".picker-samples-grid button.picker-cell").first());
    await tap("customer", left.getByRole("checkbox").first());
    await clickName("customer", "Submit request");
    await left.getByText("DM-000004").first().waitFor();
    await banner(left, "customer", "Order DM-000004 created");
    await wait(2400);

    // 2. 벤더: 다이아 후보 제출 → 자동 공개
    await go("supplier", "/supplier/tasks/PR-000006", "Step 2 — Submit diamond candidate");
    await fill("supplier", "textbox", "IGI", "LG599000111");
    await fill("supplier", "spinbutton", "Carat", "1.5");
    await fill("supplier", "spinbutton", "Cost", "520");
    await picks("supplier", 0, [0]);
    await clickName("supplier", "Submit", { exact: true });

    // 3. 고객: 스톤 선택 → 신선 배치라 재고확인 없이 자동 견적 발송 (벤더 라운드트립 제거)
    await go("customer", "/track/DM-000004", "Step 3 — Pick the diamond → auto quote");
    await clickName("customer", "Select this stone");

    // 4. 고객: 견적 수락
    await go("customer", "/track/DM-000004", "Step 4 — Accept the quote");
    await clickName("customer", "Accept quote");

    // 운영자 ①: 디파짓 확인 → CAD 태스크 자동 발행
    await go("admin", "/admin/ops/DM-000004", "Touchpoint ① — Confirm deposit");
    await clickName("admin", "Deposit received");

    // 5. 벤더: CAD V1 제출 — 드래그&드롭 파일 업로드 시연 (어르신 벤더가 폰 사진을 끌어다 놓기)
    await go("supplier", "/supplier/tasks/PR-000008", "Step 5 — Drag & drop CAD photos");
    await upload("supplier", 0, "lineup-ring.png");
    await upload("supplier", 1, "lineup-band.png");
    await clickName("supplier", "Submit", { exact: true });

    // 6. 고객: 핀으로 수정 요청
    await go("customer", "/track/DM-000004", "Step 6 — Request a change (drop a pin)");
    await clickName("customer", "Request changes");
    {
      const canvas = left.locator(".pin-canvas.is-editable");
      await canvas.waitFor({ state: "visible" });
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      const x = box.x + 180, y = box.y + 150;
      await left.evaluate(({ x, y }) => window.__cursorMove(x, y), { x, y });
      await wait(750);
      await left.evaluate(({ x, y }) => window.__cursorClick(x, y), { x, y });
      await wait(220);
      await canvas.click({ position: { x: 180, y: 150 } });
      await wait(800);
    }
    await tap("customer", left.locator(".pin-editor button.chip").filter({ hasNotText: "✕" }).first());
    await clickName("customer", "Send change request");

    // 7. 벤더: CAD V2 제출 (핀 동봉 확인)
    await go("supplier", "/supplier/tasks/PR-000011", "Step 7 — Customer pins → CAD v2");
    await wait(1400);
    await picks("supplier", 0, [0]);
    await picks("supplier", 1, [0]);
    await clickName("supplier", "Submit", { exact: true });

    // 8. 고객: 디자인 승인 → 제작 시작
    await go("customer", "/track/DM-000004", "Step 8 — Approve design → production");
    await clickName("customer", "Approve");

    // 9. 벤더: QC 제출 → 실중량 자동 정산
    await go("supplier", "/supplier/tasks/PR-000014", "Step 9 — Final QC + actual weight");
    await picks("supplier", 0, [6, 0]);
    await fill("supplier", "spinbutton", "Actual weight", "4.35");
    await clickName("supplier", "Submit", { exact: true });

    // 10. 고객: 최종 실물 컨펌
    await go("customer", "/track/DM-000004", "Step 10 — Confirm the finished piece");
    await wait(1000);
    await clickName("customer", "Confirm");

    // 운영자 ②: 잔금 확인 → 배송 태스크 자동 발행
    await go("admin", "/admin/ops/DM-000004", "Touchpoint ② — Confirm balance → ship task");
    await clickName("admin", "Balance received");

    // 11. 벤더: 운송장 제출 → SHIPPING
    await go("supplier", "/supplier/tasks/PR-000016", "Step 11 — Submit shipment");
    await fill("supplier", "textbox", "Tracking number", "1Z-LUMINA-88234901");
    await clickName("supplier", "Submit", { exact: true });

    // 운영자 ③: 수령 확인 → 배송완료
    await go("admin", "/admin/ops/DM-000004", "Touchpoint ③ — Mark received → delivered");
    await clickName("admin", "delivered");

    // 마무리
    await go("customer", "/track/DM-000004", "Delivered ✓");
    await go("supplier", "/supplier", "All tasks submitted ✓");
    await wait(3200);

    console.log("✅ 전 과정 완료");
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
