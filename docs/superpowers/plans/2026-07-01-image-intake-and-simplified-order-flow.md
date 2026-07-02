# Image-First Intake + Simplified Order Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer intake form as a full-screen image-selection flow (Gallery Flow), and simplify the post-submit order flow to Proposal(total-only) → Confirm → Zelle/Venmo Deposit.

**Architecture:** Client-side demo store (`src/lib/store.js`, localStorage) holds orders/quotes/milestones; `portalView` is the customer security projection. Quote gains proposal fields (media, stoneSpec, substitutionNote, depositReportedAt). ClientPortal drops the candidate-selection stage for a single proposal card + deposit card. IntakeForm is rebuilt from new `src/components/intake/` primitives. All copy in 4 locales via `opsStrings.js`.

**Tech Stack:** React 19, react-router 7, vitest, Playwright (manual verification), no new deps.

**Spec:** `docs/superpowers/specs/2026-07-01-image-intake-and-simplified-order-flow-design.md`
**Visual reference:** `public/intake-concepts/option-3-gallery-flow.html`, `public/intake-concepts/order-flow-concept.html` (proposal media = arrow carousel), review cards from `option-1-visual-wizard.html`.

## Global Constraints

- Customer quote projection may expose ONLY: `id, status, totalUsd, depositUsd, balanceUsd, validUntil, leadDays, proposalMedia, stoneSpec, substitutionNote, depositReportedAt`. Never `metalAmountUsd, nonMetalUsd, diamondAmountUsd, estWeightG, internal, snapshot`.
- `createIntake` payload shape unchanged (server/admin compatibility).
- All new UI strings added to `opsStrings.js` in **all 4 locales** (en/ko/zh/es) in the same task that introduces them.
- Use app design tokens (`var(--surface)`, `--line`, `--accent`, `--serif`, etc.) — never hardcoded NOIR mockup colors; must look right in both night and day themes.
- Existing behaviors kept: localStorage draft (`lumina-intake-draft`), `?style=/?category=/?diamond=` prefill, done screen with order id + query code, terms gate, `markDepositReceived` side effects (stone lock + CAD + auto PR).
- Run `npm run test` after every task; all suites green before commit.

---

### Task 1: Store layer — proposal fields, payment settings, deposit self-report, hardened projection

**Files:**
- Modify: `src/lib/store.js` (createQuote ~1378, portalView ~1610, settings seed, new `reportDepositSent`)
- Test: `src/lib/__tests__/proposalFlow.test.js` (create)
- Modify: existing tests that assert `portalView().candidates` or quote breakdown fields (`src/lib/__tests__/opsStore.test.js`, `autoFlow.test.js`, `masking.test.js` — adjust assertions to new projection)

**Interfaces:**
- Produces: `updateQuoteProposal(quoteId, { proposalMedia, stoneSpec, substitutionNote })` — admin composer API. `reportDepositSent(quoteId, actor)` → sets `depositReportedAt`, milestone `depositReceived: waitingClient`, audit. `portalView(...).quote` = projection above; `portalView` no longer returns `candidates`; keeps `selected`.
- `settings.payment = { zelle: "", venmo: "", note: "" }` seeded; editable via existing `updateSettings`.

- [ ] **Step 1: Write failing tests** (`proposalFlow.test.js`): resetDB → createIntake → createQuote → `updateQuoteProposal` stores media/spec/note → `sendQuote` → portalView quote has ONLY allowed keys (assert `Object.keys` subset + absence of breakdown fields, absence of `candidates` key) → `acceptQuote` → `reportDepositSent` sets `depositReportedAt` + milestone waitingClient → `markDepositReceived` → order status `CAD`.
- [ ] **Step 2: Run** `npm run test -- proposalFlow` — expect FAIL (functions undefined).
- [ ] **Step 3: Implement** — quote gains `proposalMedia: [], stoneSpec: null, substitutionNote: "", depositReportedAt: null` in `createQuote`; add:

```js
export function updateQuoteProposal(quoteId, { proposalMedia, stoneSpec, substitutionNote }) {
  const q = db().quotes.find((x) => x.id === quoteId);
  if (proposalMedia !== undefined) q.proposalMedia = normalizeOrderMedia(proposalMedia).slice(0, 5);
  if (stoneSpec !== undefined) q.stoneSpec = stoneSpec;
  if (substitutionNote !== undefined) q.substitutionNote = substitutionNote;
  persist(); return q;
}
export function reportDepositSent(quoteId, actor = "customer") {
  const q = db().quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "accepted" || q.depositReportedAt) return q;
  q.depositReportedAt = now();
  upsertMilestone(q.orderId, "depositReceived", { status: "waitingClient", publishToClient: true });
  audit(actor, "quote", quoteId, "depositReported", null, q.depositReportedAt);
  persist(); return q;
}
```

portalView quote projection → allowed fields only; delete `candidates` from return (keep `selected`); drop the diamondSelection action filter line. Seed `payment` in settings; `sendQuote` default `stoneSpec` from `getQuoteDiamondCandidate(orderId)` if unset (shape/carat/color/clarity/igiNo).
- [ ] **Step 4: Run full vitest; fix broken candidate/projection assertions in existing suites** (they now assert the projection, not the old shape).
- [ ] **Step 5: Commit** `feat: proposal fields + deposit self-report + hardened quote projection`

---

### Task 2: Client portal — journey rail + final proposal card (replaces candidate stage + breakdown table)

**Files:**
- Modify: `src/pages/ClientPortal.jsx` (remove candidates grid/submit panel/shortlist logic; quote panel → proposal card)
- Modify: `src/platform.css` (proposal card, journey rail, carousel arrows already exist via ClientMediaCarousel styles)
- Modify: `src/opsStrings.js` ×4 locales (portal.proposal* keys)

**Interfaces:**
- Consumes: `portalView` new projection; `acceptQuote`; `ClientMediaCarousel({ media, alt, ratio })`.
- Produces: portal layout `JourneyRail(order, quote)` — stages request/proposal/deposit/production; `ProposalCard({ quote, style, t, onConfirm, shipping* props })`.

- [ ] Journey rail (4 steps, active state from `order.status` + quote/deposit state) above checkpoints.
- [ ] Proposal card per mockup: `ClientMediaCarousel` (proposalMedia, fallback style cover), spec rows from `stoneSpec` + intake setting summary, serif total, deposit/balance split, validity + lead, substitution note (`quote.substitutionNote` fallback to default i18n copy), ShippingAddressPanel, Confirm button (`acceptQuote`, disabled until address complete). No breakdown rows anywhere.
- [ ] Remove: candidates grid, shortlist/submit/reject panel, stock-checking notes, `stoneState` now derives from `order.selectedDiamondId`/quote instead of candidates. Stone checkpoint shows locked stone (`selected`) after deposit, else proposal pointer.
- [ ] i18n keys ×4: `proposalTitle, proposalKicker, totalAllInclusive, totalMeta, depositToday, balanceBeforeShip, substitutionTitle, substitutionBody, confirmProposal, journey{request,proposal,deposit,production}` etc.
- [ ] `npm run test` green; commit `feat: portal final proposal card + journey rail`.

---

### Task 3: Client portal — deposit card (Zelle/Venmo, self-report) + balance reuse

**Files:**
- Modify: `src/pages/ClientPortal.jsx` (new `PaymentCard` component), `src/platform.css`, `src/opsStrings.js` ×4

**Interfaces:**
- Consumes: `getSettings().payment`, `reportDepositSent(quoteId)`; `quote.depositReportedAt`; milestones.
- Produces: `PaymentCard({ amountUsd, referenceId, payment, reported, onReport, t })` — used for deposit (after accept) and balance (status BALANCE, via `markBalanceReceived` wait).

- [ ] Deposit card active once `quote.status === "accepted"` && deposit milestone not done: method tiles (Zelle/Venmo + copy-to-clipboard), amount, memo line with order id, "I've sent the deposit" → `reportDepositSent`; reported state shows "확인 중 · 24h" notice; done state collapses to ✓.
- [ ] Balance: when `order.status === "BALANCE"`, same card with `quote.balanceUsd`, self-report only notifies via chat message (`sendOrderMessage` system line) — keep admin `markBalanceReceived` as confirm.
- [ ] Hero "next action" copy: proposal→confirm, accepted→deposit instructions anchor `#pay-stage`.
- [ ] i18n ×4: `pay{zelle,venmo,copy,copied,memo(order),sent,sentHelp,waitingConfirm,deposit,balance,feeNote}`.
- [ ] Tests green; commit `feat: Zelle/Venmo payment card with deposit self-report`.

---

### Task 4: Admin — proposal composer, deposit-reported badge, payment settings

**Files:**
- Modify: `src/pages/admin/AdminOpsOrder.jsx` (quote panel → proposal composer; nextAction badge), `src/pages/admin/AdminSettings.jsx` (payment handles), `src/opsStrings.js` ×4 (ops admin keys)

**Interfaces:**
- Consumes: `updateQuoteProposal`, `sendQuote`, `markDepositReceived`, `getQuoteDiamondCandidate`.

- [ ] Proposal composer on draft quote: media picker (reuse `MediaPicker` ≤5), stoneSpec fields prefilled from linked candidate (shape/carat/color/clarity/igiNo editable), substitution note textarea (default copy), then existing Send. Breakdown table stays admin-visible here.
- [ ] Deposit wait: where `nextAction` = markDeposit (line ~1109), show `depositReportedAt` badge ("고객 송금 보고 · {time}") so admin confirms with context.
- [ ] AdminSettings: text inputs for `payment.zelle`, `payment.venmo`, `payment.note` via `updateSettings({ payment: { ...settings.payment, zelle } })`.
- [ ] Tests green; commit `feat: admin proposal composer + payment settings`.

---

### Task 5: Intake primitives — gallery step kit

**Files:**
- Create: `src/components/intake/GalleryStep.jsx` (full-screen step shell: kicker/title/hint slot, progress dots, back/skip footer, slide transition)
- Create: `src/components/intake/pickers.jsx` (`ImageOptionGrid`, `MetalSwatches`, `ShapeTiles` + `DIAMOND_SHAPE_SVGS`, `CaratSlider`, `ScalePicker`)
- Modify: `src/styles.css` (`.gflow-*` classes with app tokens)
- Test: `src/lib/__tests__/intakeOptions.test.js` — pure helpers (`metalOptionsFor(p)`, shape keys = BENCHMARK_SHAPES, carat px math)

**Interfaces (produced, exact):**
- `GalleryStep({ index, total, kicker, title, hint, onBack, onSkip, skippable, children })`
- `ImageOptionGrid({ options: [{ value, label, sub?, media:{kind,src}|null }], value, onSelect, columns })` — calls `onSelect(value)` once (auto-advance handled by parent)
- `MetalSwatches({ value, onSelect, labels })` (OPS_METALS order, gradient dots)
- `ShapeTiles({ value, onSelect, labels })` (9 BENCHMARK_SHAPES inline SVGs)
- `CaratSlider({ value, onChange, min=0.5, max=4, step=0.1 })` (scaled stone preview)
- `ScalePicker({ options: [{value,label,sub?}], value, onSelect })`

- [ ] Implement kit + CSS (both themes), helper test first, commit `feat: intake gallery-flow primitives`.

---

### Task 6: IntakeForm rebuild — Gallery Flow

**Files:**
- Rewrite: `src/pages/IntakeForm.jsx`
- Modify: `src/opsStrings.js` ×4 (gallery flow questions/copy), `src/styles.css` if needed
- Test: `src/lib/__tests__/intakePayload.test.js` — build-form helper produces `createIntake`-compatible payload for ring/necklace/multi cases

**Screens (state `screen: 0..6`, kept in draft):** category → design(style cards for category via `listOpsStyles`, + "not sure" = open brief) → metal → shape(solitaire) → carat(solitaire) → inspiration(MediaPicker, skippable) → review.
**Review sheet:** image summary cards (piece/stone/inspiration), size&fit chips per category (same required validation as old `validateStep(0)`), quality row default `E · VS1 · CVD · IGI` with inline adjust (ScalePicker color/clarity), requiredDate (LuxuryDatePicker), contact fields when `!user`, terms checkbox, submit → `createIntake` (payload identical incl. `multiSpec` defaults when multi), done screen unchanged.
**Keep:** draft autosave/restore (with screen index), URL prefill (skip prefilled screens), StoneEdu via "What's this?" inline toggle on shape/carat screens, `sanitizeReferenceMedia`.

- [ ] Payload test first (extract pure `buildIntakePayload(form, refs, user)` module-level so it's testable), then rebuild page, run vitest + manual smoke, commit `feat: gallery-flow image-first intake form`.

---

### Task 7: End-to-end verification

- [ ] `npm run test` + `npm run test:server` — all green.
- [ ] Playwright walkthrough (script in scratchpad): submit intake (ring, solitaire) → admin: create+send proposal quote (seeded demo admin) → portal: confirm → deposit self-report → admin: mark received → portal shows CAD stage. Screenshots of each screen (night + day theme for intake) for the user.
- [ ] Fix anything found; final commit.
