// Customer + admin full order-flow recording.
// Usage: with the Vite dev server running, run:
//   node scripts/demo-customer-admin-record.mjs
// Output:
//   demo-video/customer-admin-order-flow-en.mp4

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const BASE = process.env.DEMO_BASE_URL || "http://127.0.0.1:5173";
const OUT_DIR = "demo-video";
const OUT_FILE = `${OUT_DIR}/customer-admin-order-flow-en.mp4`;
const PANE = { width: 900, height: 820 };
const LANG = "en";
const THEME = "day";
const ORDER_ID = "DM-000001";
const QUERY_CODE = "QX7K-M9P2";
const USERS = { customer: "u-customer", admin: "u-admin" };
const ASSET = (name) => new URL(`../public/assets/${name}`, import.meta.url).pathname;

const ROLE_STYLE = {
  customer: { bg: "#1f6f43", label: "CUSTOMER · Jiwon Kim" },
  admin: { bg: "#8a5a1e", label: "ADMIN · BeloveD order control" },
};

let customerPage;
let adminPage;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const paneOf = (role) => (role === "customer" ? customerPage : adminPage);

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
  if (path.startsWith("/track/")) {
    await page.locator(".client-workspace-hero").waitFor({ state: "visible", timeout: 10000 });
  }
  if (path.startsWith("/admin/orders/")) {
    await page.locator(".ops-order-page").waitFor({ state: "visible", timeout: 10000 });
  }
  await banner(page, role, step);
  await page.bringToFront();
  await wait(850);
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
  await wait(420);
}

async function attachMedia(role, files) {
  const page = paneOf(role);
  const editor = page.locator(".ops-proxy-editor").first();
  await editor.scrollIntoViewIfNeeded();
  await point(role, editor.locator(".drop-zone").first());
  await editor.locator('input[type="file"]').first().setInputFiles(files.map(ASSET));
  await editor.locator(".picker-list-item").first().waitFor({ timeout: 10000 });
  await wait(650);
}

async function storeEval(page, fn, arg = {}) {
  return page.evaluate(async ({ source, input }) => {
    const store = await import("/src/lib/store.js");
    return (0, eval)(`(${source})`)(store, input);
  }, { source: fn.toString(), input: arg });
}

async function simulateShipment() {
  await storeEval(adminPage, (store) => {
    const pr = store.listProcurements({ orderId: "DM-000001" })
      .find((item) => item.type === "ship" && item.status === "open");
    if (!pr) throw new Error("open ship procurement missing");
    store.submitShipment(pr.id, { trackingNo: "1Z-BELOVED-88234901", shippedAt: "2026-08-28" });
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: PANE, recordVideo: { dir: OUT_DIR, size: PANE } });
  await context.addInitScript(({ lang, theme }) => {
    localStorage.setItem("lumina-locale", lang);
    localStorage.setItem("lumina-theme", theme);
  }, { lang: LANG, theme: THEME });
  await context.addInitScript(CURSOR_INIT);

  customerPage = await context.newPage();
  adminPage = await context.newPage();

  try {
    await customerPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await customerPage.evaluate(({ lang, theme }) => {
      localStorage.removeItem("lumina-db-v14");
      localStorage.removeItem("lumina-session");
      localStorage.setItem("lumina-locale", lang);
      localStorage.setItem("lumina-theme", theme);
    }, { lang: LANG, theme: THEME });

    await go("customer", `/track/${ORDER_ID}?code=${QUERY_CODE}`, "Step 1 — choose a diamond");
    await go("admin", `/admin/orders/${ORDER_ID}`, "Order command center");

    await tap("customer", customerPage.locator(".diamond-select-button:not([disabled])").first());
    await tap("customer", customerPage.locator(".diamond-submit-panel .customer-decision-actions .button.primary"));
    await customerPage.getByText(/Selection saved|Quote/i).first().waitFor({ timeout: 8000 });
    await banner(customerPage, "customer", "Selection saved · quote and deposit open");
    await wait(1000);

    await go("admin", `/admin/orders/${ORDER_ID}`, "Step 2 — waiting for quote & deposit");
    await adminPage.getByText(/Waiting for customer/i).first().waitFor({ timeout: 8000 });

    await go("customer", `/track/${ORDER_ID}?code=${QUERY_CODE}`, "Step 3 — review and accept quote");
    await fillField("customer", customerPage.locator(".shipping-address-card input").nth(1), "+1 213-555-0100");
    await fillField("customer", customerPage.locator(".shipping-address-card input").nth(2), "550 S Hill St");
    await fillField("customer", customerPage.locator(".shipping-address-card input").nth(4), "Los Angeles");
    await fillField("customer", customerPage.locator(".shipping-address-card input").nth(5), "CA");
    await fillField("customer", customerPage.locator(".shipping-address-card input").nth(6), "90013");
    await tap("customer", customerPage.locator(".pay-panel .button.primary"));
    await customerPage.getByText(/Quote accepted/i).first().waitFor({ timeout: 8000 });

    await go("admin", `/admin/orders/${ORDER_ID}`, "Touchpoint 1 — deposit received");
    await tap("admin", adminPage.getByRole("button", { name: /Deposit received/i }));
    await adminPage.getByText(/Order stage updated/i).first().waitFor({ timeout: 8000 });

    await go("admin", `/admin/orders/${ORDER_ID}`, "Step 4 — send design approval media");
    await attachMedia("admin", ["lineup-ring.png", "lineup-band.png"]);
    await fillField("admin", adminPage.locator(".ops-proxy-editor textarea"), "CAD render and side view for approval.");
    await tap("admin", adminPage.getByRole("button", { name: /Send design for approval/i }));
    await adminPage.getByText(/Uploaded to order workspace/i).first().waitFor({ timeout: 8000 });

    await go("customer", `/track/${ORDER_ID}?code=${QUERY_CODE}`, "Step 5 — approve the design");
    await tap("customer", customerPage.locator("#design-stage .customer-decision-actions .button.primary"));
    await customerPage.getByText(/Design approved/i).first().waitFor({ timeout: 8000 });

    await go("admin", `/admin/orders/${ORDER_ID}`, "Step 6 — send finished-piece QC");
    await tap("admin", adminPage.getByText(/Finished-piece confirmation/i).first());
    await attachMedia("admin", ["hero-diamond-ring.png", "lineup-ring.png"]);
    await fillField("admin", adminPage.locator(".ops-proxy-editor textarea"), "Final QC photos, certificate, and measured weight are ready.");
    await fillField("admin", adminPage.locator(".ops-proxy-editor input").nth(1), "IGI verified");
    await fillField("admin", adminPage.locator(".ops-proxy-editor input").nth(2), "4.35");
    await tap("admin", adminPage.getByRole("button", { name: /Send finished piece for confirmation/i }));
    await adminPage.getByText(/Uploaded to order workspace/i).first().waitFor({ timeout: 8000 });

    await go("customer", `/track/${ORDER_ID}?code=${QUERY_CODE}`, "Step 7 — confirm the finished piece");
    await tap("customer", customerPage.locator("#final-stage .customer-decision-actions .button.primary"));
    await customerPage.getByText(/Finished piece confirmed/i).first().waitFor({ timeout: 8000 });

    await go("admin", `/admin/orders/${ORDER_ID}`, "Touchpoint 2 — balance received");
    await tap("admin", adminPage.getByRole("button", { name: /Balance received/i }));
    await adminPage.getByText(/Order stage updated/i).first().waitFor({ timeout: 8000 });

    await banner(adminPage, "admin", "Shipment event simulated · tracking received");
    await simulateShipment();
    await wait(950);

    await go("admin", `/admin/orders/${ORDER_ID}`, "Touchpoint 3 — mark delivered");
    await tap("admin", adminPage.getByRole("button", { name: /mark delivered/i }));
    await adminPage.getByText(/Order stage updated/i).first().waitFor({ timeout: 8000 });

    await go("customer", `/track/${ORDER_ID}?code=${QUERY_CODE}`, "Delivered ✓");
    await go("admin", `/admin/orders/${ORDER_ID}`, "Order delivered ✓");
    await wait(2500);

    console.log(`Demo order flow recorded for ${ORDER_ID}`);
  } catch (error) {
    console.error("Demo recording failed:", error.message.split("\n")[0]);
    try { await customerPage.screenshot({ path: `${OUT_DIR}/customer-admin-error-customer.png`, fullPage: true }); } catch {}
    try { await adminPage.screenshot({ path: `${OUT_DIR}/customer-admin-error-admin.png`, fullPage: true }); } catch {}
    throw error;
  } finally {
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
    console.log(`Video written: ${OUT_FILE}`);
  }
}

main();
