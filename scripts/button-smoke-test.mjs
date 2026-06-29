import { chromium } from "playwright";

const baseURL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const locale = process.env.SMOKE_LOCALE || "ko";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript((selectedLocale) => {
  localStorage.setItem("lumina-locale", selectedLocale);
}, locale);

const page = await context.newPage();
const failures = [];

page.on("pageerror", (error) => {
  failures.push(`pageerror: ${error.message}`);
});
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (/favicon|404 \(Not Found\)|ResizeObserver loop/i.test(text)) return;
  failures.push(`console error: ${text}`);
});
page.on("dialog", async (dialog) => {
  await dialog.accept();
});

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label, details = "") {
  throw new Error(`${label}${details ? `: ${details}` : ""}`);
}

async function goto(path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function resetDb() {
  await goto("/");
  await page.evaluate((selectedLocale) => {
    localStorage.removeItem("lumina-db-v14");
    localStorage.removeItem("lumina-session");
    localStorage.setItem("lumina-locale", selectedLocale);
  }, locale);
}

async function setSession(userId) {
  await goto("/");
  await page.evaluate(({ selectedLocale, selectedUserId }) => {
    localStorage.setItem("lumina-session", selectedUserId);
    localStorage.setItem("lumina-locale", selectedLocale);
  }, { selectedLocale: locale, selectedUserId: userId });
}

async function click(locator, label) {
  if ((await locator.count()) === 0) fail(label, "not found");
  const target = locator.first();
  await target.scrollIntoViewIfNeeded();
  await target.click();
  pass(label);
}

async function assertUrlIncludes(fragment, label) {
  await page.waitForURL((url) => url.href.includes(fragment), { timeout: 3000 }).catch(() => {});
  if (!page.url().includes(fragment)) fail(label, `expected URL to include ${fragment}, got ${page.url()}`);
  pass(label);
}

async function assertVisible(pattern, label) {
  await page.getByText(pattern).first().waitFor({ timeout: 3000 });
  pass(label);
}

async function visibleCount(locator) {
  const count = await locator.count();
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) visible += 1;
  }
  return visible;
}

async function waitForStatus(pattern, label) {
  const source = pattern.source;
  await page.waitForFunction((patternSource) => {
    const text = [...document.querySelectorAll('[role="status"]')]
      .map((node) => node.textContent || "")
      .join(" ");
    return new RegExp(patternSource, "i").test(text);
  }, source, { timeout: 3000 });
  pass(label);
}

async function selectNextOption(locator, label) {
  if ((await locator.count()) === 0) fail(label, "select not found");
  const select = locator.first();
  const current = await select.inputValue();
  const values = await select.locator("option").evaluateAll((options) => (
    options.map((option) => option.value).filter(Boolean)
  ));
  const next = values.find((value) => value !== current) || current;
  await select.selectOption(next);
  pass(label);
}

async function blurAfterFill(locator, value, label) {
  if ((await locator.count()) === 0) fail(label, "input not found");
  const target = locator.first();
  await target.fill(value);
  await target.blur();
  pass(label);
}

function qaMediaSource(label) {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#080705"/>
      <circle cx="600" cy="360" r="180" fill="#d6b464" opacity=".18"/>
      <text x="600" y="350" fill="#f5ead1" font-size="72" font-family="Georgia, serif" text-anchor="middle">${label}</text>
      <text x="600" y="430" fill="#c7a455" font-size="28" font-family="Arial, sans-serif" text-anchor="middle">BeloveD QA media</text>
    </svg>
  `)}`;
}

async function storeEval(fn, arg = {}) {
  return page.evaluate(async ({ source, arg: input }) => {
    const store = await import("/src/lib/store.js");
    return (0, eval)(`(${source})`)(store, input);
  }, { source: fn.toString(), arg });
}

async function smokeHome() {
  await resetDb();
  await goto("/");
  await click(page.locator(".hero-noir-pause"), "home: hero pause/play button");
  await click(page.locator(".hero-noir-pause"), "home: hero play/pause button");

  await click(page.locator(".hero-noir-ctas .noir-btn"), "home: hero primary CTA");
  await assertUrlIncludes("/custom/new", "home: hero primary navigates");

  await goto("/");
  await click(page.locator(".hero-noir-ctas .noir-link"), "home: hero explore CTA");
  await assertUrlIncludes("/designs", "home: explore navigates");

  await goto("/");
  const categories = page.locator(".coll-noir-piece");
  const categoryCount = await categories.count();
  if (categoryCount < 4) fail("home: category cards", `expected 4 cards, got ${categoryCount}`);
  for (let index = 0; index < categoryCount; index += 1) {
    await goto("/");
    await click(categories.nth(index), `home: category card ${index + 1}`);
    await assertUrlIncludes("/designs?category=", `home: category card ${index + 1} navigates`);
  }

  await goto("/");
  await click(page.locator(".spread-noir-actions .noir-btn"), "home: price board primary CTA");
  await assertUrlIncludes("/custom/new", "home: price board primary navigates");
  await goto("/");
  await click(page.locator(".spread-noir-actions .noir-link"), "home: price board secondary CTA");
  await assertUrlIncludes("/custom/new", "home: price board secondary navigates");
}

async function smokeAccount() {
  await resetDb();
  await setSession("u-customer");
  await goto("/account");
  const guestLookupVisible = await visibleCount(page.getByRole("link", { name: /비회원 조회|Guest lookup|访客查询|Consulta invitado/i }));
  if (guestLookupVisible > 0) fail("account: member page hides guest lookup", "guest lookup link is visible");
  pass("account: member page hides guest lookup");

  const newRequestCta = page.locator(".account-head .button.primary");
  await click(newRequestCta, "account: new request CTA");
  await assertUrlIncludes("/custom/new", "account: new request navigates");
}

async function smokePortalAccess() {
  await resetDb();
  await goto("/track/DM-000001?code=WRONG");
  await assertVisible(/주문이 없거나|Order not found|订单不存在|Pedido no encontrado/i, "portal: rejects wrong guest code");

  await goto("/track/DM-000001?code=QX7K-M9P2");
  await assertVisible(/DM-000001/, "portal: guest code opens order");

  await setSession("u-customer");
  await goto("/track/DM-000001");
  await assertVisible(/DM-000001/, "portal: member opens own order");

  await goto("/track/DM-000002?code=H3WT-8RVK");
  await assertVisible(/주문이 없거나|Order not found|订单不存在|Pedido no encontrado/i, "portal: member cannot use guest code for another customer's order");
}

async function smokeClientPortalActions() {
  await resetDb();
  await setSession("u-customer");
  await goto("/track/DM-000001");

  const chooseButton = page.locator(".diamond-select-button:not([disabled])").first();
  await click(chooseButton, "portal: choose diamond button");
  await waitForStatus(/선택|selected|elegido|选择/i, "portal: choose diamond notice");

  await click(page.locator(".diamond-submit-panel .customer-decision-actions .button.primary"), "portal: submit selected diamond");
  await waitForStatus(/저장|saved|guardada|已保存/i, "portal: submit diamond notice");

  await page.locator("#conversation").scrollIntoViewIfNeeded();
  await blurAfterFill(page.locator("#conversation textarea"), "QA customer message", "portal: chat draft");
  await click(page.locator("#conversation button[type='submit']"), "portal: send chat");
  await waitForStatus(/메시지|message|消息|mensaje/i, "portal: chat notice");
}

async function smokeOrderControl() {
  await resetDb();
  await setSession("u-admin");
  await goto("/admin/orders");
  const rows = page.locator('[data-testid="admin-order-row"]');
  const rowCount = await rows.count();
  if (rowCount === 0) fail("orders: table rows", "no orders rendered");
  const orderId = await rows.first().getAttribute("data-order-id");
  await click(rows.first(), "orders: full row click");
  await assertUrlIncludes(`/admin/orders/${orderId}`, "orders: row opens detail");

  await goto(`/admin/orders/${orderId}`);
  await click(page.locator(".ops-next-actions a.button.secondary"), "order detail: open customer portal link");
  await assertUrlIncludes(`/track/${orderId}`, "order detail: customer portal navigates");

  await goto(`/admin/orders/${orderId}`);
  await selectNextOption(page.locator(".ops-flow-card select").first(), "order detail: customer flow status select");
  await waitForStatus(/상태|status/i, "order detail: status save notice");

  await blurAfterFill(page.locator(".ops-flow-card input").first(), "QA customer-visible update", "order detail: customer update input");
  await waitForStatus(/고객 업데이트|customer update/i, "order detail: customer update notice");

  await click(page.locator(".ops-flow-visibility").first(), "order detail: customer visibility button");
  await waitForStatus(/고객 포털|customer portal|visibility/i, "order detail: visibility save notice");

  await selectNextOption(page.locator(".ops-internal-card select"), "order detail: internal status select");
  await waitForStatus(/상태|status/i, "order detail: internal status notice");

  await blurAfterFill(page.locator(".ops-internal-card textarea"), "QA internal note", "order detail: internal notes");
  await waitForStatus(/내부 메모|internal note/i, "order detail: internal note notice");

  await blurAfterFill(page.locator(".admin-conversation-form textarea"), "QA chat message", "order detail: chat draft");
  await click(page.locator(".admin-conversation-form button[type='submit']"), "order detail: send chat");
  await waitForStatus(/메시지|message/i, "order detail: chat notice");

  const stageCards = page.locator(".ops-proxy-stage-card");
  const stageCount = await stageCards.count();
  for (let index = 0; index < stageCount; index += 1) {
    await click(stageCards.nth(index), `order detail: proxy stage tab ${index + 1}`);
  }

  const advancedDetails = page.locator("details.ops-admin-details").last();
  if ((await advancedDetails.count()) > 0) {
    await click(advancedDetails.locator("summary"), "order detail: advanced disclosure");
    await advancedDetails.locator("form").first().locator("input[type='date']").first().fill("2026-08-01");
    await click(advancedDetails.locator("form").first().locator("button[type='submit']"), "order detail: create procurement request");
    await waitForStatus(/조달 요청|Procurement/i, "order detail: procurement notice");
  }
}

async function smokeStyleLibrary() {
  await resetDb();
  await setSession("u-admin");
  await goto("/admin/designs");

  const filterButtons = page.locator(".admin-style-filters button");
  const filterCount = await filterButtons.count();
  if (filterCount === 0) fail("styles: category filters", "no filter buttons");
  for (let index = 0; index < Math.min(filterCount, 5); index += 1) {
    await click(filterButtons.nth(index), `styles: category filter ${index + 1}`);
  }

  const rows = page.locator(".admin-style-row");
  if ((await rows.count()) === 0) fail("styles: rows", "no styles rendered");
  await click(rows.first().locator(".admin-style-row-main"), "styles: select row");

  const arrows = page.locator(".admin-media-arrow");
  if ((await visibleCount(arrows)) > 0) {
    await click(arrows.last(), "styles: media next arrow");
    await click(arrows.first(), "styles: media previous arrow");
  }

  await click(rows.first().locator(".admin-state-chip").first(), "styles: available toggle");
  await waitForStatus(/저장|saved/i, "styles: available toggle notice");
  await click(rows.first().locator(".admin-state-chip").nth(1), "styles: published toggle");
  await waitForStatus(/저장|saved/i, "styles: published toggle notice");

  await click(rows.first().locator(".button.small").first(), "styles: view/edit row button");
  await click(page.locator(".admin-locale-tabs button").nth(1), "styles: public text locale tab");
  await click(page.locator(".admin-style-editor-panel button[type='submit']"), "styles: save style button");
  await waitForStatus(/저장|saved|保存|guard/i, "styles: save style notice");

  const collapsible = page.locator(".admin-collapsible-panel");
  if ((await collapsible.count()) > 0) {
    await click(collapsible.first().locator("summary"), "styles: catalog copy disclosure");
    await click(collapsible.first().locator("button").last(), "styles: save catalog copy");
    await waitForStatus(/저장|saved|保存|guard/i, "styles: catalog save notice");
  }

  if ((await collapsible.count()) > 1) {
    const specsPanel = collapsible.nth(1);
    await click(specsPanel.locator("summary"), "styles: spec disclosure");
    await specsPanel.locator("select").first().selectOption({ index: 1 });
    await click(specsPanel.locator("button").last(), "styles: add production spec");
    await waitForStatus(/제작 스펙|Production spec|规格|Especificación/i, "styles: spec save notice");
    await click(specsPanel.locator("table button").last(), "styles: delete production spec");
    await waitForStatus(/삭제|deleted|elimin/i, "styles: spec delete notice");
  }

  await click(page.locator(".admin-panel-head .button.primary.small").first(), "styles: new style button");
}

async function smokeCustomerAdminRoundTrip() {
  await resetDb();
  await setSession("u-customer");
  await goto("/track/DM-000001");

  await click(page.locator(".diamond-select-button:not([disabled])").first(), "journey: select a diamond candidate");
  await click(page.locator(".diamond-submit-panel .customer-decision-actions .button.primary"), "journey: submit selected diamond");
  await assertVisible(/견적|Quote|Cotización|报价/i, "journey: submitted diamond opens quote");

  const quoteActionVisible = await visibleCount(page.locator(".client-workspace-hero").getByText(/견적 확인 후 수락|Review and accept your quote|Revisa y acepta tu cotización|查看并接受报价/i));
  if (quoteActionVisible === 0) fail("journey: submitted diamond next action", "quote/deposit action is not shown");
  pass("journey: submitted diamond waits on customer quote/deposit");

  await setSession("u-admin");
  await goto("/admin/orders/DM-000001");
  await assertVisible(/고객 확인 대기|Waiting for customer|等待客户确认|Esperando al cliente/i, "journey: admin waits for quote/deposit acceptance");
  const stockConfirmVisible = await visibleCount(page.getByText(/선택된 다이아 재고 확인|Confirm selected diamond stock|确认所选钻石库存|Confirmar stock del diamante seleccionado/i));
  if (stockConfirmVisible > 0) fail("journey: admin stock confirmation removed", "stock confirmation is still shown");
  pass("journey: admin stock confirmation removed");

  await setSession("u-customer");
  await goto("/track/DM-000001");
  await blurAfterFill(page.locator(".shipping-address-card input").nth(1), "+1 213-555-0100", "journey: shipping phone");
  await blurAfterFill(page.locator(".shipping-address-card input").nth(2), "550 S Hill St", "journey: shipping street");
  await blurAfterFill(page.locator(".shipping-address-card input").nth(4), "Los Angeles", "journey: shipping city");
  await blurAfterFill(page.locator(".shipping-address-card input").nth(5), "CA", "journey: shipping state");
  await blurAfterFill(page.locator(".shipping-address-card input").nth(6), "90013", "journey: shipping zip");
  await click(page.locator(".pay-panel .button.primary"), "journey: accept quote and deposit terms");
  await waitForStatus(/견적|Quote accepted|Cotización aceptada|报价已接受/i, "journey: quote accepted notice");

  await setSession("u-admin");
  await goto("/admin/orders/DM-000001");
  await click(page.getByRole("button", { name: /디파짓 수령|Deposit received|定金|Depósito/i }), "journey: admin confirms deposit");
  await waitForStatus(/단계|stage|状态|actualiz/i, "journey: deposit stage notice");

  await storeEval((store, { media }) => {
    store.addCadVersion("DM-000001", {
      media: [{ kind: "image", src: media, name: "cad-draft.svg", slot: "front" }],
      supplierId: "ops-proxy",
      note: "QA design draft",
    });
  }, { media: qaMediaSource("CAD draft") });

  await setSession("u-customer");
  await goto("/track/DM-000001");
  await page.locator("#design-stage").scrollIntoViewIfNeeded();
  await click(page.locator("#design-stage .customer-decision-actions .button.secondary"), "journey: reject first design draft");
  await blurAfterFill(page.locator("#design-stage .customer-reject-box textarea"), "Please soften the prongs.", "journey: design rejection reason");
  await click(page.locator("#design-stage .customer-reject-box .button.primary"), "journey: submit design rejection");
  await waitForStatus(/반려|수정|sent|revision|rechaz|已发送/i, "journey: design rejection notice");

  await storeEval((store, { media }) => {
    store.addCadVersion("DM-000001", {
      media: [{ kind: "image", src: media, name: "cad-revision.svg", slot: "front" }],
      supplierId: "ops-proxy",
      note: "QA revised design",
    });
  }, { media: qaMediaSource("CAD revision") });

  await goto("/track/DM-000001");
  await page.locator("#design-stage").scrollIntoViewIfNeeded();
  await click(page.locator("#design-stage .customer-decision-actions .button.primary"), "journey: approve revised design");
  await waitForStatus(/승인|approved|aprob|已确认/i, "journey: design approval notice");

  await storeEval((store, { media }) => {
    store.publishFinalMedia("DM-000001", {
      media: [{ kind: "image", src: media, name: "final-qc.svg" }],
      note: "QA final media",
    }, "ops");
  }, { media: qaMediaSource("Final QC") });

  await goto("/track/DM-000001");
  await page.locator("#final-stage").scrollIntoViewIfNeeded();
  await click(page.locator("#final-stage .customer-decision-actions .button.secondary"), "journey: reject final media");
  await blurAfterFill(page.locator("#final-stage .customer-reject-box textarea"), "Please send one more clasp angle.", "journey: final rejection reason");
  await click(page.locator("#final-stage .customer-reject-box .button.primary"), "journey: submit final rejection");
  await waitForStatus(/반려|sent|rechaz|已发送/i, "journey: final rejection notice");

  await storeEval((store, { media }) => {
    store.publishFinalMedia("DM-000001", {
      media: [{ kind: "image", src: media, name: "final-approved.svg" }],
      note: "QA final media revised",
    }, "ops");
  }, { media: qaMediaSource("Final approved") });

  await goto("/track/DM-000001");
  await page.locator("#final-stage").scrollIntoViewIfNeeded();
  await click(page.locator("#final-stage .customer-decision-actions .button.primary"), "journey: approve final media");
  await waitForStatus(/완성품|컨펌|confirmed|final|confirmado|已确认/i, "journey: final approval notice");

  await page.locator("#conversation").scrollIntoViewIfNeeded();
  await blurAfterFill(page.locator("#conversation textarea"), "Everything looks good. Thank you.", "journey: customer chat after approvals");
  await click(page.locator("#conversation button[type='submit']"), "journey: send customer chat");
  await waitForStatus(/메시지|message|消息|mensaje/i, "journey: chat notice");
}

try {
  await smokeHome();
  await smokePortalAccess();
  await smokeOrderControl();
  await smokeStyleLibrary();
  await smokeAccount();
  await smokeClientPortalActions();
  await smokeCustomerAdminRoundTrip();
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
  console.log("Button smoke test passed.");
} finally {
  await browser.close();
}
