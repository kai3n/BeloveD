import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail } from "../mailer.js";
import { truncateAuth, truncateCustomerCore, truncateSuppliers } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  __resetRateLimit();
  drainMail();
  await truncateSuppliers();
  await truncateCustomerCore();
  await truncateAuth();
});

async function adminCookie() {
  await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
    ["vendor-admin@example.com", "Vendor Admin", hashPassword("admin12345")]);
  const login = await request(app).post("/v1/auth/password")
    .send({ email: "vendor-admin@example.com", password: "admin12345" });
  return login.headers["set-cookie"];
}

async function createOrder(email = "private-customer@example.com") {
  const result = await request(app).post("/v1/intakes").send({
    email,
    name: "Private Customer",
    phone: "+1 555 0100",
    locale: "en",
    category: "ring",
    productLine: "solitaire",
    termsAccepted: true,
    conditional: { ringSize: "6", engraving: "secret" },
  });
  expect(result.status).toBe(201);
  return result.body.orderCode;
}

async function inviteAndActivate(admin, email, displayName) {
  const created = await request(app).post("/v1/admin/suppliers").set("Cookie", admin)
    .send({ email, displayName, contactName: displayName, locale: "zh" });
  expect(created.status).toBe(201);
  const supplierCode = created.body.supplier.supplierCode;
  const invitation = await request(app).post(`/v1/admin/suppliers/${supplierCode}/invites`).set("Cookie", admin);
  expect(invitation.status).toBe(201);
  const token = new URL(invitation.body.inviteUrl).searchParams.get("token");
  const accepted = await request(app).post("/v1/vendor/auth/accept-invite")
    .send({ token, password: "vendor-pass-123" });
  expect(accepted.status).toBe(200);
  drainMail();
  return { supplierCode, cookie: accepted.headers["set-cookie"] };
}

async function advanceSolitaireToProduction(admin, vendorCookie, jobCode) {
  const accepted = await request(app).post(`/v1/vendor/orders/${jobCode}/stage`).set("Cookie", vendorCookie)
    .send({ type: "ACCEPT" });
  expect(accepted.body.transition.workflowState).toBe("CANDIDATES_REQUIRED");

  const candidates = await request(app).post(`/v1/vendor/orders/${jobCode}/updates`).set("Cookie", vendorCookie).send({
    type: "STONE",
    note: "Order-specific candidate batch",
    data: {
      candidateCount: 10,
      batchValidUntil: "2026-08-15",
      temporaryHoldUntil: "2026-08-03T12:00:00.000Z",
      igiNumbers: "IGI-10001\nIGI-10002",
      availabilityConfirmed: true,
    },
  });
  expect(candidates.status).toBe(201);
  expect((await request(app).patch(`/v1/admin/supplier-updates/${candidates.body.update.id}/review`).set("Cookie", admin)
    .send({ status: "approved" })).body.update.status).toBe("approved");

  const locked = await request(app).post(`/v1/admin/supplier-jobs/${jobCode}/transition`).set("Cookie", admin)
    .send({ action: "LOCK_DIAMOND", lockedDiamondRef: "IGI-10001" });
  expect(locked.body.job).toMatchObject({ workflowState: "DIAMOND_LOCKED", lockedDiamond: "IGI-10001" });
  expect((await request(app).post(`/v1/admin/supplier-jobs/${jobCode}/transition`).set("Cookie", admin)
    .send({ action: "OPEN_ESTIMATE" })).body.job.workflowState).toBe("ESTIMATE_REQUIRED");

  const estimate = await request(app).post(`/v1/vendor/orders/${jobCode}/updates`).set("Cookie", vendorCookie).send({
    type: "ESTIMATE",
    note: "Supplier cost estimate only",
    data: {
      netWeightG: 4.8,
      lossPct: 6,
      laborCost: 1200,
      materialCost: 300,
      leadTimeDays: 18,
      currency: "CNY",
      assumptions: "PT950, US size 6, selected 1.5ct center stone",
    },
  });
  expect(estimate.status).toBe(201);
  await request(app).patch(`/v1/admin/supplier-updates/${estimate.body.update.id}/review`).set("Cookie", admin)
    .send({ status: "approved" });
  for (const action of ["PREPARE_QUOTE", "CUSTOMER_ACCEPT_QUOTE", "CONFIRM_DEPOSIT"]) {
    const transition = await request(app).post(`/v1/admin/supplier-jobs/${jobCode}/transition`).set("Cookie", admin).send({ action });
    expect(transition.status).toBe(200);
  }

  const cad = await request(app).post(`/v1/vendor/orders/${jobCode}/updates`).set("Cookie", vendorCookie)
    .send({ type: "CAD", note: "CAD v1" });
  expect(cad.status).toBe(201);
  expect((await request(app).patch(`/v1/admin/supplier-updates/${cad.body.update.id}/review`).set("Cookie", admin)
    .send({ status: "approved" })).status).toBe(200);
  expect((await request(app).post(`/v1/admin/supplier-jobs/${jobCode}/transition`).set("Cookie", admin)
    .send({ action: "APPROVE" })).body.job.workflowState).toBe("DESIGN_APPROVED");
  const production = await request(app).post(`/v1/vendor/orders/${jobCode}/stage`).set("Cookie", vendorCookie)
    .send({ type: "CONFIRM_PRODUCTION" });
  expect(production.body.transition.workflowState).toBe("IN_PRODUCTION");
}

describe("one account per vendor", () => {
  it("defaults activation links to the same-origin /vendor/ app", async () => {
    const previousAppUrl = process.env.VENDOR_APP_URL;
    const previousVendorOrigin = process.env.VENDOR_ORIGIN;
    delete process.env.VENDOR_APP_URL;
    process.env.VENDOR_ORIGIN = "https://belovediamond.com";
    try {
      const admin = await adminCookie();
      const created = await request(app).post("/v1/admin/suppliers").set("Cookie", admin).send({
        email: "same-origin-vendor@example.com", displayName: "Same Origin Vendor", contactName: "Vendor Contact", locale: "zh",
      });
      const invitation = await request(app)
        .post(`/v1/admin/suppliers/${created.body.supplier.supplierCode}/invites`)
        .set("Cookie", admin);
      const inviteUrl = new URL(invitation.body.inviteUrl);
      expect(inviteUrl.origin).toBe("https://belovediamond.com");
      expect(inviteUrl.pathname).toBe("/vendor/");
      expect(inviteUrl.searchParams.get("token")).toBeTruthy();
    } finally {
      if (previousAppUrl === undefined) delete process.env.VENDOR_APP_URL;
      else process.env.VENDOR_APP_URL = previousAppUrl;
      if (previousVendorOrigin === undefined) delete process.env.VENDOR_ORIGIN;
      else process.env.VENDOR_ORIGIN = previousVendorOrigin;
    }
  });

  it("emails a subpath-safe activation link and exposes the pending invitation state", async () => {
    const previousAppUrl = process.env.VENDOR_APP_URL;
    process.env.VENDOR_APP_URL = "https://vendor.example.com/BeloveD/vendor/";
    try {
      const admin = await adminCookie();
      const created = await request(app).post("/v1/admin/suppliers").set("Cookie", admin).send({
        email: "new-vendor@example.com", displayName: "New Vendor", contactName: "Vendor Contact", locale: "en",
      });
      const supplierCode = created.body.supplier.supplierCode;
      const invitation = await request(app).post(`/v1/admin/suppliers/${supplierCode}/invites`).set("Cookie", admin);
      expect(invitation.status).toBe(201);
      expect(invitation.body.emailSent).toBe(true);
      const inviteUrl = new URL(invitation.body.inviteUrl);
      expect(inviteUrl.pathname).toBe("/BeloveD/vendor/");
      expect(inviteUrl.searchParams.get("token")).toBeTruthy();
      expect(drainMail()).toEqual([expect.objectContaining({
        type: "vendor_invite", to: "new-vendor@example.com", link: invitation.body.inviteUrl, locale: "en",
      })]);

      const directory = await request(app).get("/v1/admin/suppliers").set("Cookie", admin);
      expect(directory.body.suppliers[0]).toMatchObject({ supplierCode, status: "invited" });
      expect(directory.body.suppliers[0].invitedAt).toBeTruthy();
      expect(directory.body.suppliers[0].inviteExpiresAt).toBeTruthy();
    } finally {
      if (previousAppUrl === undefined) delete process.env.VENDOR_APP_URL;
      else process.env.VENDOR_APP_URL = previousAppUrl;
    }
  });

  it("resets a vendor password with a one-time link while keeping existing sessions", async () => {
    const admin = await adminCookie();
    const email = "password-reset@example.com";
    const vendor = await inviteAndActivate(admin, email, "Password Reset Vendor");

    const unknown = await request(app).post("/v1/vendor/auth/password-reset/request")
      .send({ email: "unknown@example.com" });
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual({ ok: true });
    expect(drainMail()).toEqual([]);

    const requested = await request(app).post("/v1/vendor/auth/password-reset/request").send({ email });
    expect(requested.status).toBe(202);
    expect(requested.body).toEqual({ ok: true });
    const messages = drainMail();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "vendor_password_reset", to: email, locale: "zh" });
    const resetToken = new URL(messages[0].link).searchParams.get("reset");
    expect(resetToken).toBeTruthy();

    const reset = await request(app).post("/v1/vendor/auth/password-reset/confirm")
      .send({ token: resetToken, password: "new-vendor-pass-456" });
    expect(reset.status).toBe(200);
    expect(reset.body.supplier.email).toBe(email);
    const newCookie = reset.headers["set-cookie"];

    expect((await request(app).get("/v1/vendor/me").set("Cookie", vendor.cookie)).status).toBe(200);
    expect((await request(app).get("/v1/vendor/me").set("Cookie", newCookie)).status).toBe(200);
    expect((await request(app).post("/v1/vendor/auth/password")
      .send({ email, password: "vendor-pass-123" })).status).toBe(401);
    expect((await request(app).post("/v1/vendor/auth/password")
      .send({ email, password: "new-vendor-pass-456" })).status).toBe(200);

    const reused = await request(app).post("/v1/vendor/auth/password-reset/confirm")
      .send({ token: resetToken, password: "another-vendor-pass-789" });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe("SUPPLIER_PASSWORD_RESET_INVALID");
  });

  it("invites the vendor, assigns only its order, and strips customer PII", async () => {
    const admin = await adminCookie();
    const orderCode = await createOrder();
    const first = await inviteAndActivate(admin, "factory-one@example.com", "Factory One");
    const second = await inviteAndActivate(admin, "factory-two@example.com", "Factory Two");

    const assigned = await request(app).post(`/v1/admin/orders/${orderCode}/supplier`).set("Cookie", admin)
      .send({ supplierCode: first.supplierCode, dueAt: "2026-08-01T00:00:00.000Z" });
    expect(assigned.status).toBe(201);
    const jobCode = assigned.body.assignment.jobCode;

    const own = await request(app).get(`/v1/vendor/orders/${jobCode}`).set("Cookie", first.cookie);
    expect(own.status).toBe(200);
    expect(own.body.order.jobCode).toBe(jobCode);
    expect(own.body.order.workflowState).toBe("ASSIGNED");
    expect(JSON.stringify(own.body)).not.toContain(orderCode);
    expect(JSON.stringify(own.body)).not.toContain("private-customer@example.com");
    expect(JSON.stringify(own.body)).not.toContain("Private Customer");
    expect(JSON.stringify(own.body)).not.toContain("+1 555 0100");

    const otherList = await request(app).get("/v1/vendor/orders").set("Cookie", second.cookie);
    expect(otherList.status).toBe(200);
    expect(otherList.body.orders).toEqual([]);
    const otherDetail = await request(app).get(`/v1/vendor/orders/${jobCode}`).set("Cookie", second.cookie);
    expect(otherDetail.status).toBe(403);
    expect(otherDetail.body.error.code).toBe("ORDER_ACCESS_DENIED");
  });

  it("scopes updates and inventory to the logged-in vendor", async () => {
    const admin = await adminCookie();
    const orderCode = await createOrder("inventory-owner@example.com");
    const first = await inviteAndActivate(admin, "inventory-one@example.com", "Inventory One");
    const second = await inviteAndActivate(admin, "inventory-two@example.com", "Inventory Two");
    const assignment = await request(app).post(`/v1/admin/orders/${orderCode}/supplier`).set("Cookie", admin)
      .send({ supplierCode: first.supplierCode });
    const jobCode = assignment.body.assignment.jobCode;

    await advanceSolitaireToProduction(admin, first.cookie, jobCode);

    const update = await request(app).post(`/v1/vendor/orders/${jobCode}/updates`).set("Cookie", first.cookie)
      .send({ type: "PROGRESS", note: "Setting complete", media: [{ name: "progress.jpg", url: "https://media.example/progress.jpg" }] });
    expect(update.status).toBe(201);
    expect(update.body.update.version).toBe(1);
    expect(update.body.update.status).toBe("submitted");
    await request(app).patch(`/v1/admin/supplier-updates/${update.body.update.id}/review`).set("Cookie", admin)
      .send({ status: "changes_requested", reviewNote: "Please add the side view" });
    const replacement = await request(app).post(`/v1/vendor/orders/${jobCode}/updates`).set("Cookie", first.cookie)
      .send({ type: "PROGRESS", note: "Updated setting" });
    expect(replacement.body.update.version).toBe(2);
    const reviewed = await request(app).patch(`/v1/admin/supplier-updates/${replacement.body.update.id}/review`).set("Cookie", admin)
      .send({ status: "approved", reviewNote: "Approved" });
    expect(reviewed.status).toBe(200);
    const detail = await request(app).get(`/v1/vendor/orders/${jobCode}`).set("Cookie", first.cookie);
    expect(detail.body.order.workflowState).toBe("QC_REQUIRED");
    expect(detail.body.order.updates[0]).toMatchObject({ version: 2, status: "approved", reviewNote: "Approved" });
    expect(detail.body.order.updates[1]).toMatchObject({ version: 1, status: "superseded" });
    expect((await request(app).post(`/v1/vendor/orders/${jobCode}/updates`).set("Cookie", second.cookie)
      .send({ type: "PROGRESS", note: "intrusion" })).status).toBe(403);

    const created = await request(app).post("/v1/vendor/inventory").set("Cookie", first.cookie).send({
      supplierSku: "STONE-001", certificateNo: "IGI-1", shape: "round", carat: 1.25,
      color: "E", clarity: "VS1", procurementCostUsd: 500,
    });
    expect(created.status).toBe(201);
    const inventoryId = created.body.stone.id;
    expect((await request(app).get("/v1/vendor/inventory").set("Cookie", second.cookie)).body.inventory).toEqual([]);
    const otherPatch = await request(app).patch(`/v1/vendor/inventory/${inventoryId}`).set("Cookie", second.cookie)
      .send({ availability: "sold" });
    expect(otherPatch.status).toBe(404);
  });

  it("revokes live sessions when an admin suspends a vendor", async () => {
    const admin = await adminCookie();
    const vendor = await inviteAndActivate(admin, "suspend@example.com", "Suspend Me");
    expect((await request(app).get("/v1/vendor/me").set("Cookie", vendor.cookie)).status).toBe(200);
    const suspended = await request(app).patch(`/v1/admin/suppliers/${vendor.supplierCode}`).set("Cookie", admin)
      .send({ status: "suspended" });
    expect(suspended.status).toBe(200);
    expect((await request(app).get("/v1/vendor/me").set("Cookie", vendor.cookie)).status).toBe(401);
  });
});
