import { randomBytes } from "node:crypto";
import { ApiError } from "./errors.js";
import { query, withTransaction } from "./db.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { hashToken, issueSession, revokeAllForPrincipal } from "./session.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SUPPLIER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPDATE_TYPES = new Set(["ACKNOWLEDGE", "NOTE", "STONE", "ESTIMATE", "CAD", "PROGRESS", "QC", "SHIPPING", "HANDOFF_READY"]);
const VERSIONED_UPDATE_TYPES = new Set(["STONE", "ESTIMATE", "CAD", "PROGRESS", "QC", "SHIPPING"]);
const REVIEW_STATUSES = new Set(["approved", "changes_requested"]);
const VENDOR_WORKFLOW_TRANSITIONS = {
  CONFIRM_PRODUCTION: { from: ["DESIGN_APPROVED"], to: "IN_PRODUCTION" },
  CONFIRM_HANDOFF: { from: ["QC_APPROVED"], to: "HANDOFF_READY" },
};
const SUBMISSION_WORKFLOW = {
  STONE: { from: ["CANDIDATES_REQUIRED", "CANDIDATES_CHANGES"], to: "CANDIDATES_REVIEW" },
  ESTIMATE: { from: ["ESTIMATE_REQUIRED", "ESTIMATE_CHANGES"], to: "ESTIMATE_REVIEW" },
  CAD: { from: ["DESIGN_REQUIRED", "DESIGN_CHANGES"], to: "DESIGN_REVIEW" },
  PROGRESS: { from: ["IN_PRODUCTION", "PROGRESS_CHANGES"], to: "PROGRESS_REVIEW" },
  QC: { from: ["QC_REQUIRED", "QC_CHANGES"], to: "QC_REVIEW" },
};
const ADMIN_WORKFLOW_TRANSITIONS = {
  LOCK_DIAMOND: { from: ["CUSTOMER_STONE_SELECTION"], to: "DIAMOND_LOCKED" },
  OPEN_ESTIMATE: { from: ["DIAMOND_LOCKED"], to: "ESTIMATE_REQUIRED" },
  PREPARE_QUOTE: { from: ["ESTIMATE_APPROVED"], to: "QUOTE_CUSTOMER_REVIEW" },
  CUSTOMER_ACCEPT_QUOTE: { from: ["QUOTE_CUSTOMER_REVIEW"], to: "DEPOSIT_REQUIRED" },
  CONFIRM_DEPOSIT: { from: ["DEPOSIT_REQUIRED"], to: "DESIGN_REQUIRED" },
  APPROVE: { from: ["CUSTOMER_CAD_REVIEW"], to: "DESIGN_APPROVED" },
  REQUEST_CHANGES: { from: ["CUSTOMER_CAD_REVIEW"], to: "DESIGN_CHANGES" },
};
const LOCALES = new Set(["zh", "en", "ko"]);
const SUPPLIER_STATUSES = new Set(["invited", "active", "suspended", "archived"]);
const INVENTORY_AVAILABILITY = new Set(["available", "reserved", "unavailable", "sold"]);
const DUMMY_HASH = hashPassword(randomBytes(32).toString("hex"));

function emailOf(value) {
  return String(value || "").trim().toLowerCase();
}

function finiteNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function validateStructuredUpdate(type, value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (type === "STONE") {
    const candidateCount = finiteNumber(data.candidateCount, { min: 1, max: 20 });
    const batchValidUntil = String(data.batchValidUntil || "").trim();
    const temporaryHoldUntil = String(data.temporaryHoldUntil || "").trim();
    const igiNumbers = String(data.igiNumbers || "").trim();
    const availabilityConfirmed = data.availabilityConfirmed === true;
    if (!Number.isInteger(candidateCount) || !/^\d{4}-\d{2}-\d{2}$/.test(batchValidUntil) || !igiNumbers || !availabilityConfirmed) {
      throw new ApiError("VALIDATION_ERROR", 400);
    }
    if (igiNumbers.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).length > 20) {
      throw new ApiError("VALIDATION_ERROR", 400);
    }
    if (temporaryHoldUntil && Number.isNaN(Date.parse(temporaryHoldUntil))) throw new ApiError("VALIDATION_ERROR", 400);
    return { candidateCount, batchValidUntil, temporaryHoldUntil, igiNumbers, availabilityConfirmed };
  }
  if (type === "ESTIMATE") {
    const netWeightG = finiteNumber(data.netWeightG, { min: 0.01, max: 10000 });
    const lossPct = finiteNumber(data.lossPct, { min: 0, max: 100 });
    const laborCost = finiteNumber(data.laborCost, { min: 0, max: 100000000 });
    const materialCost = finiteNumber(data.materialCost, { min: 0, max: 100000000 });
    const leadTimeDays = finiteNumber(data.leadTimeDays, { min: 1, max: 3650 });
    const currency = String(data.currency || "").toUpperCase();
    const assumptions = String(data.assumptions || "").trim();
    if (netWeightG === null || lossPct === null || laborCost === null || materialCost === null
      || !Number.isInteger(leadTimeDays) || !new Set(["CNY", "USD"]).has(currency)
      || !assumptions || assumptions.length > 2000) throw new ApiError("VALIDATION_ERROR", 400);
    return { netWeightG, lossPct, laborCost, materialCost, leadTimeDays, currency, assumptions };
  }
  return {};
}

function supplierView(row) {
  return {
    id: row.id,
    supplierCode: row.supplier_code,
    displayName: row.display_name,
    email: row.email,
    contactName: row.contact_name,
    status: row.status,
    locale: row.locale,
    timezone: row.timezone,
    activeOrderCount: Number(row.active_order_count || 0),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function vendorOrderView(row) {
  // Never pass the whole customer order summary through: it later accumulates
  // addresses, tracking and payment receipts. Only production-safe fields are
  // copied into the vendor contract.
  const source = row.summary || {};
  const summary = {
    category: source.category ?? null,
    styleCode: source.styleCode ?? null,
    metal: source.metal ?? null,
    heroMedia: source.heroMedia ?? null,
    measurements: source.measurements ?? {},
  };
  return {
    jobCode: row.job_code,
    stage: row.stage,
    phase: row.phase,
    expectedCompletionAt: row.expected_completion_at,
    dueAt: row.vendor_due_at,
    assignedAt: row.assigned_at,
    acceptedAt: row.accepted_at,
    workflowState: row.workflow_state,
    lockedDiamond: row.locked_diamond_ref || null,
    category: row.intake_category,
    productLine: row.product_line,
    styleCode: row.style_code,
    summary,
    referenceMedia: row.reference_media || [],
    requiredDate: row.required_date,
    updatedAt: row.updated_at,
  };
}

function inventoryView(row) {
  return {
    id: row.id,
    supplierSku: row.supplier_sku,
    certificateNo: row.certificate_no,
    shape: row.shape,
    carat: row.carat === null ? null : Number(row.carat),
    color: row.color,
    clarity: row.clarity,
    growthMethod: row.growth_method,
    procurementCostUsd: row.procurement_cost_usd === null ? null : Number(row.procurement_cost_usd),
    availability: row.availability,
    reservedOrderId: row.reserved_order_id,
    media: row.media || [],
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSuppliers() {
  const { rows } = await query(`
    select s.*, count(a.id) filter (where a.status = 'active') as active_order_count
    from suppliers s
    left join supplier_order_assignments a on a.supplier_id = s.id
    group by s.id
    order by s.created_at desc
  `);
  return rows.map(supplierView);
}

export async function createSupplier(payload, adminId) {
  const email = emailOf(payload.email);
  const displayName = String(payload.displayName || "").trim();
  const contactName = String(payload.contactName || displayName).trim();
  const locale = LOCALES.has(payload.locale) ? payload.locale : "zh";
  if (!EMAIL_RE.test(email) || !displayName || !contactName) throw new ApiError("VALIDATION_ERROR", 400);
  return withTransaction(async (client) => {
    const seq = await client.query("select nextval('supplier_code_seq') as n");
    const supplierCode = `SUP-${String(seq.rows[0].n).padStart(6, "0")}`;
    const { rows } = await client.query(`
      insert into suppliers (supplier_code, display_name, email, contact_name, locale)
      values ($1,$2,$3,$4,$5) returning *
    `, [supplierCode, displayName, email, contactName, locale]);
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, after_json)
      values ('admin', $1, 'supplier', $2, 'created', $3)
    `, [String(adminId), supplierCode, rows[0]]);
    return supplierView(rows[0]);
  }).catch((error) => {
    if (error?.code === "23505") throw new ApiError("SUPPLIER_EMAIL_EXISTS", 409);
    throw error;
  });
}

export async function createSupplierInvite(supplierCode, adminId) {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const { rows } = await query(
    "select * from suppliers where supplier_code=$1 and status in ('invited','active')",
    [supplierCode],
  );
  const supplier = rows[0];
  if (!supplier) throw new ApiError("SUPPLIER_NOT_FOUND", 404);
  await withTransaction(async (client) => {
    await client.query("update supplier_invites set revoked_at=now() where supplier_id=$1 and accepted_at is null and revoked_at is null", [supplier.id]);
    await client.query(`
      insert into supplier_invites (token_hash, supplier_id, expires_at, created_by_admin_id)
      values ($1,$2,$3,$4)
    `, [hashToken(raw), supplier.id, expiresAt, adminId]);
  });
  return { token: raw, expiresAt, supplier: supplierView(supplier) };
}

export async function acceptSupplierInvite(rawToken, password) {
  if (typeof rawToken !== "string" || typeof password !== "string" || password.length < 8) {
    throw new ApiError("VALIDATION_ERROR", 400);
  }
  const supplier = await withTransaction(async (client) => {
    const { rows } = await client.query(`
      select s.*, i.expires_at, i.accepted_at, i.revoked_at
      from supplier_invites i join suppliers s on s.id=i.supplier_id
      where i.token_hash=$1 for update of i
    `, [hashToken(rawToken)]);
    const row = rows[0];
    if (!row || row.accepted_at || row.revoked_at || new Date(row.expires_at) <= new Date()
      || !new Set(["invited", "active"]).has(row.status)) {
      throw new ApiError("SUPPLIER_INVITE_INVALID", 400);
    }
    await client.query("update supplier_invites set accepted_at=now() where token_hash=$1", [hashToken(rawToken)]);
    const updated = await client.query(`
      update suppliers set password_hash=$1, status='active', updated_at=now()
      where id=$2 returning *
    `, [hashPassword(password), row.id]);
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, after_json)
      values ('supplier', $1, 'supplier', $1, 'invite_accepted', $2)
    `, [row.supplier_code, supplierView(updated.rows[0])]);
    return updated.rows[0];
  });
  return { supplier: supplierView(supplier), session: await issueSession("supplier", supplier.id, SUPPLIER_SESSION_TTL_MS) };
}

export async function loginSupplier(email, password) {
  const normalized = emailOf(email);
  const { rows } = await query("select * from suppliers where email=$1 and status='active'", [normalized]);
  const supplier = rows[0];
  const valid = verifyPassword(password, supplier?.password_hash || DUMMY_HASH);
  if (!supplier?.password_hash || !valid) {
    throw new ApiError("INVALID_CREDENTIALS", 401);
  }
  await query("update suppliers set last_login_at=now(), updated_at=now() where id=$1", [supplier.id]);
  return { supplier: supplierView(supplier), session: await issueSession("supplier", supplier.id, SUPPLIER_SESSION_TTL_MS) };
}

export async function getSupplierById(id) {
  const { rows } = await query("select * from suppliers where id=$1", [id]);
  return rows[0] ? supplierView(rows[0]) : null;
}

export async function updateSupplierStatus(supplierCode, status, adminId) {
  if (!SUPPLIER_STATUSES.has(status)) throw new ApiError("VALIDATION_ERROR", 400);
  const { rows } = await query(`
    update suppliers set status=$2, updated_at=now()
    where supplier_code=$1 returning *
  `, [supplierCode, status]);
  const supplier = rows[0];
  if (!supplier) throw new ApiError("SUPPLIER_NOT_FOUND", 404);
  if (status !== "active") await revokeAllForPrincipal("supplier", supplier.id);
  await query(`
    insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, after_json)
    values ('admin', $1, 'supplier', $2, 'status_changed', $3)
  `, [String(adminId), supplierCode, supplierView(supplier)]);
  return supplierView(supplier);
}

export async function assignSupplierOrder({ supplierCode, orderCode, dueAt }, adminId) {
  return withTransaction(async (client) => {
    const supplier = (await client.query("select * from suppliers where supplier_code=$1 and status='active'", [supplierCode])).rows[0];
    const order = (await client.query("select * from customer_orders where order_code=$1 for update", [orderCode])).rows[0];
    if (!supplier) throw new ApiError("SUPPLIER_NOT_FOUND", 404);
    if (!order) throw new ApiError("ORDER_NOT_FOUND", 404);
    await client.query(`
      update supplier_order_assignments
      set status='revoked', revoked_at=now()
      where order_id=$1 and status='active'
    `, [order.id]);
    const { rows } = await client.query(`
      insert into supplier_order_assignments (supplier_id, order_id, assigned_by_admin_id, due_at)
      values ($1,$2,$3,$4)
      on conflict (supplier_id, order_id) do update set
        status='active', assigned_by_admin_id=excluded.assigned_by_admin_id,
        assigned_at=now(), due_at=excluded.due_at, revoked_at=null, accepted_at=null,
        workflow_state='ASSIGNED', locked_diamond_ref=null, diamond_locked_at=null,
        customer_quote_accepted_at=null, deposit_confirmed_at=null
      returning *
    `, [supplier.id, order.id, adminId, dueAt || null]);
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, after_json)
      values ('admin', $1, 'supplier_order_assignment', $2, 'assigned', $3)
    `, [String(adminId), orderCode, rows[0]]);
    return { supplier: supplierView(supplier), jobCode: rows[0].job_code, dueAt: rows[0].due_at };
  });
}

const ORDER_SELECT = `
  select o.stage, o.phase, o.expected_completion_at, o.summary, o.updated_at,
         a.job_code, a.workflow_state, a.assigned_at, a.accepted_at, a.locked_diamond_ref,
         a.due_at as vendor_due_at,
         i.category as intake_category, i.product_line, i.style_code, i.required_date, i.reference_media
  from supplier_order_assignments a
  join customer_orders o on o.id=a.order_id
  join customer_intakes i on i.id=o.intake_id
  where a.supplier_id=$1 and a.status in ('active','completed')
`;

export async function listSupplierOrders(supplierId) {
  const { rows } = await query(`${ORDER_SELECT} order by o.updated_at desc`, [supplierId]);
  return rows.map(vendorOrderView);
}

export async function getSupplierOrder(supplierId, jobCode) {
  const { rows } = await query(`${ORDER_SELECT} and a.job_code=$2`, [supplierId, jobCode]);
  if (!rows[0]) throw new ApiError("ORDER_ACCESS_DENIED", 403);
  const updates = await query(`
    select id, update_type, note, media, data, version, review_status, review_note,
           reviewed_at, supersedes_update_id, created_at
    from supplier_updates
    where supplier_id=$1 and order_id=(
      select order_id from supplier_order_assignments
      where supplier_id=$1 and job_code=$2 and status in ('active','completed')
    )
    order by created_at desc
  `, [supplierId, jobCode]);
  return { ...vendorOrderView(rows[0]), updates: updates.rows.map((row) => ({
    id: row.id,
    type: row.update_type,
    note: row.note,
    media: row.media || [],
    data: row.data || {},
    version: row.version,
    status: row.review_status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    supersedesUpdateId: row.supersedes_update_id,
    createdAt: row.created_at,
  })) };
}

export async function addSupplierUpdate(supplierId, jobCode, payload = {}) {
  const type = String(payload.type || "NOTE").toUpperCase();
  const note = payload.note == null ? null : String(payload.note).trim();
  const media = Array.isArray(payload.media) ? payload.media.slice(0, 12) : [];
  const data = validateStructuredUpdate(type, payload.data);
  if (!UPDATE_TYPES.has(type) || (note && note.length > 2000)) throw new ApiError("VALIDATION_ERROR", 400);
  return withTransaction(async (client) => {
    const access = await client.query(`
      select o.id, a.workflow_state from customer_orders o join supplier_order_assignments a on a.order_id=o.id
      where a.job_code=$1 and a.supplier_id=$2 and a.status='active' for update of a
    `, [jobCode, supplierId]);
    if (!access.rows[0]) throw new ApiError("ORDER_ACCESS_DENIED", 403);
    const orderId = access.rows[0].id;
    const submission = SUBMISSION_WORKFLOW[type];
    if (submission) {
      if (!submission.from.includes(access.rows[0].workflow_state)) throw new ApiError("INVALID_SUPPLIER_WORKFLOW_TRANSITION", 409);
      await client.query("update supplier_order_assignments set workflow_state=$3 where supplier_id=$1 and order_id=$2", [supplierId, orderId, submission.to]);
    }
    const versioned = VERSIONED_UPDATE_TYPES.has(type);
    const previous = versioned ? (await client.query(`
      select * from supplier_updates
      where supplier_id=$1 and order_id=$2 and update_type=$3
      order by version desc, created_at desc limit 1
    `, [supplierId, orderId, type])).rows[0] : null;
    const version = previous ? Number(previous.version) + 1 : 1;
    if (previous && previous.review_status !== "superseded") {
      await client.query("update supplier_updates set review_status='superseded' where id=$1", [previous.id]);
    }
    const { rows } = await client.query(`
      insert into supplier_updates
        (supplier_id, order_id, update_type, note, media, data, version, review_status, supersedes_update_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *
    `, [supplierId, orderId, type, note, JSON.stringify(media), JSON.stringify(data), version,
      versioned ? "submitted" : "approved", previous?.id || null]);
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
      values ('supplier', $1, 'supplier_job', $2, $3, $4, $5)
    `, [String(supplierId), jobCode, type.toLowerCase(), previous || null, rows[0]]);
    return {
      id: rows[0].id,
      type,
      note,
      media,
      data,
      version,
      status: rows[0].review_status,
      supersedesUpdateId: previous?.id || null,
      createdAt: rows[0].created_at,
    };
  });
}

export async function transitionSupplierWorkflow(supplierId, jobCode, action) {
  const normalized = action === "ACKNOWLEDGE" ? "ACCEPT" : action === "HANDOFF_READY" ? "CONFIRM_HANDOFF" : String(action || "").toUpperCase();
  return withTransaction(async (client) => {
    const before = (await client.query(`
      select a.*, i.product_line
      from supplier_order_assignments a
      join customer_orders o on o.id=a.order_id
      join customer_intakes i on i.id=o.intake_id
      where a.supplier_id=$1 and a.job_code=$2 and a.status='active' for update of a
    `, [supplierId, jobCode])).rows[0];
    if (!before) throw new ApiError("ORDER_ACCESS_DENIED", 403);
    const transition = normalized === "ACCEPT"
      ? { from: ["ASSIGNED"], to: before.product_line === "multi" ? "ESTIMATE_REQUIRED" : "CANDIDATES_REQUIRED" }
      : VENDOR_WORKFLOW_TRANSITIONS[normalized];
    if (!transition) throw new ApiError("VALIDATION_ERROR", 400);
    if (!transition.from.includes(before.workflow_state)) throw new ApiError("INVALID_SUPPLIER_WORKFLOW_TRANSITION", 409);
    const updated = (await client.query(`
      update supplier_order_assignments set workflow_state=$3,
        accepted_at=case when $4='ACCEPT' then coalesce(accepted_at,now()) else accepted_at end
      where id=$1 and supplier_id=$2 returning *
    `, [before.id, supplierId, transition.to, normalized])).rows[0];
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
      values ('supplier', $1, 'supplier_job', $2, $3, $4, $5)
    `, [String(supplierId), jobCode, normalized.toLowerCase(), before, updated]);
    return { jobCode, workflowState: updated.workflow_state, acceptedAt: updated.accepted_at };
  });
}

export async function reviewSupplierUpdate(updateId, status, reviewNote, adminId) {
  if (!REVIEW_STATUSES.has(status)) throw new ApiError("VALIDATION_ERROR", 400);
  const note = reviewNote == null ? null : String(reviewNote).trim();
  if (note && note.length > 2000) throw new ApiError("VALIDATION_ERROR", 400);
  return withTransaction(async (client) => {
    const before = (await client.query("select * from supplier_updates where id=$1 for update", [updateId])).rows[0];
    if (!before) throw new ApiError("SUPPLIER_UPDATE_NOT_FOUND", 404);
    if (!VERSIONED_UPDATE_TYPES.has(before.update_type) || before.review_status !== "submitted") {
      throw new ApiError("SUPPLIER_UPDATE_NOT_REVIEWABLE", 409);
    }
    const expectedReviewState = {
      STONE: "CANDIDATES_REVIEW",
      ESTIMATE: "ESTIMATE_REVIEW",
      CAD: "DESIGN_REVIEW",
      PROGRESS: "PROGRESS_REVIEW",
      QC: "QC_REVIEW",
    }[before.update_type];
    if (expectedReviewState) {
      const assignment = (await client.query(`
        select workflow_state from supplier_order_assignments
        where supplier_id=$1 and order_id=$2 and status='active' for update
      `, [before.supplier_id, before.order_id])).rows[0];
      if (assignment?.workflow_state !== expectedReviewState) throw new ApiError("INVALID_SUPPLIER_WORKFLOW_TRANSITION", 409);
    }
    const updated = (await client.query(`
      update supplier_updates set review_status=$2, review_note=$3,
        reviewed_at=now(), reviewed_by_admin_id=$4
      where id=$1 returning *
    `, [updateId, status, note, adminId])).rows[0];
    const reviewTransitions = {
      STONE: status === "approved" ? "CUSTOMER_STONE_SELECTION" : "CANDIDATES_CHANGES",
      ESTIMATE: status === "approved" ? "ESTIMATE_APPROVED" : "ESTIMATE_CHANGES",
      CAD: status === "approved" ? "CUSTOMER_CAD_REVIEW" : "DESIGN_CHANGES",
      PROGRESS: status === "approved" ? "QC_REQUIRED" : "PROGRESS_CHANGES",
      QC: status === "approved" ? "QC_APPROVED" : "QC_CHANGES",
    };
    const nextWorkflow = reviewTransitions[updated.update_type];
    if (nextWorkflow) {
      await client.query(`
        update supplier_order_assignments set workflow_state=$3
        where supplier_id=$1 and order_id=$2 and status='active'
      `, [updated.supplier_id, updated.order_id, nextWorkflow]);
    }
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
      values ('admin', $1, 'supplier_update', $2, 'reviewed', $3, $4)
    `, [String(adminId), String(updateId), before, updated]);
    return {
      id: updated.id,
      type: updated.update_type,
      version: updated.version,
      status: updated.review_status,
      reviewNote: updated.review_note,
      reviewedAt: updated.reviewed_at,
    };
  });
}

export async function transitionSupplierJobByAdmin(jobCode, action, payload = {}, adminId) {
  const normalized = String(action || "").toUpperCase();
  const transition = ADMIN_WORKFLOW_TRANSITIONS[normalized];
  if (!transition) throw new ApiError("VALIDATION_ERROR", 400);
  return withTransaction(async (client) => {
    const before = (await client.query(`
      select * from supplier_order_assignments
      where job_code=$1 and status='active' for update
    `, [jobCode])).rows[0];
    if (!before) throw new ApiError("SUPPLIER_JOB_NOT_FOUND", 404);
    if (!transition.from.includes(before.workflow_state)) throw new ApiError("INVALID_SUPPLIER_WORKFLOW_TRANSITION", 409);
    const lockedDiamondRef = normalized === "LOCK_DIAMOND" ? String(payload.lockedDiamondRef || "").trim() : null;
    if (normalized === "LOCK_DIAMOND" && !lockedDiamondRef) throw new ApiError("VALIDATION_ERROR", 400);
    const updated = (await client.query(`
      update supplier_order_assignments set
        workflow_state=$2,
        locked_diamond_ref=case when $3='LOCK_DIAMOND' then $4 else locked_diamond_ref end,
        diamond_locked_at=case when $3='LOCK_DIAMOND' then now() else diamond_locked_at end,
        customer_quote_accepted_at=case when $3='CUSTOMER_ACCEPT_QUOTE' then now() else customer_quote_accepted_at end,
        deposit_confirmed_at=case when $3='CONFIRM_DEPOSIT' then now() else deposit_confirmed_at end
      where id=$1 returning *
    `, [before.id, transition.to, normalized, lockedDiamondRef])).rows[0];
    if (before.workflow_state === "CUSTOMER_CAD_REVIEW" && normalized === "REQUEST_CHANGES") {
      await client.query(`
        update supplier_updates set review_status='changes_requested', review_note=$3,
          reviewed_at=now(), reviewed_by_admin_id=$4
        where id=(select id from supplier_updates where supplier_id=$1 and order_id=$2
          and update_type='CAD' order by version desc limit 1)
      `, [before.supplier_id, before.order_id, String(payload.reviewNote || "客户要求修改").trim(), adminId]);
    }
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
      values ('admin', $1, 'supplier_job', $2, $3, $4, $5)
    `, [String(adminId), jobCode, normalized.toLowerCase(), before, updated]);
    return { jobCode, workflowState: updated.workflow_state, lockedDiamond: updated.locked_diamond_ref };
  });
}

export async function completeSupplierJob(jobCode, adminId) {
  return withTransaction(async (client) => {
    const before = (await client.query("select * from supplier_order_assignments where job_code=$1 and status='active' for update", [jobCode])).rows[0];
    if (!before) throw new ApiError("SUPPLIER_JOB_NOT_FOUND", 404);
    if (before.workflow_state !== "HANDOFF_READY") throw new ApiError("INVALID_SUPPLIER_WORKFLOW_TRANSITION", 409);
    const updated = (await client.query(`
      update supplier_order_assignments set workflow_state='COMPLETED', status='completed'
      where id=$1 returning *
    `, [before.id])).rows[0];
    await client.query(`
      insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
      values ('admin', $1, 'supplier_job', $2, 'completed', $3, $4)
    `, [String(adminId), jobCode, before, updated]);
    return { jobCode, workflowState: updated.workflow_state };
  });
}

export async function listSupplierInventory(supplierId) {
  const { rows } = await query("select * from supplier_inventory where supplier_id=$1 and archived_at is null order by updated_at desc", [supplierId]);
  return rows.map(inventoryView);
}

export async function saveSupplierInventory(supplierId, payload = {}, inventoryId = null) {
  const sku = String(payload.supplierSku || "").trim();
  if (!sku && !inventoryId) throw new ApiError("VALIDATION_ERROR", 400);
  const id = inventoryId == null ? null : Number(inventoryId);
  if (inventoryId != null && (!Number.isSafeInteger(id) || id <= 0)) throw new ApiError("VALIDATION_ERROR", 400);
  const carat = payload.carat == null || payload.carat === "" ? null : Number(payload.carat);
  const cost = payload.procurementCostUsd == null || payload.procurementCostUsd === "" ? null : Number(payload.procurementCostUsd);
  if ((carat != null && (!Number.isFinite(carat) || carat <= 0))
    || (cost != null && (!Number.isFinite(cost) || cost < 0))) throw new ApiError("VALIDATION_ERROR", 400);
  if (payload.availability != null && !INVENTORY_AVAILABILITY.has(payload.availability)) {
    throw new ApiError("VALIDATION_ERROR", 400);
  }
  if (id) {
    const { rows } = await query(`
      update supplier_inventory set
        certificate_no=coalesce($3,certificate_no), shape=coalesce($4,shape), carat=coalesce($5,carat),
        color=coalesce($6,color), clarity=coalesce($7,clarity), growth_method=coalesce($8,growth_method),
        procurement_cost_usd=coalesce($9,procurement_cost_usd), availability=coalesce($10,availability),
        media=coalesce($11,media), updated_at=now()
      where id=$1 and supplier_id=$2 and archived_at is null returning *
    `, [id, supplierId, payload.certificateNo, payload.shape, carat, payload.color, payload.clarity,
      payload.growthMethod, cost, payload.availability, payload.media ? JSON.stringify(payload.media) : null]);
    if (!rows[0]) throw new ApiError("INVENTORY_NOT_FOUND", 404);
    return inventoryView(rows[0]);
  }
  const result = await query(`
    insert into supplier_inventory
      (supplier_id,supplier_sku,certificate_no,shape,carat,color,clarity,growth_method,procurement_cost_usd,availability,media)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *
  `, [supplierId, sku, payload.certificateNo || null, payload.shape || null, carat,
    payload.color || null, payload.clarity || null, payload.growthMethod || null,
    cost, payload.availability || "available", JSON.stringify(payload.media || [])]).catch((error) => {
    if (error?.code === "23505") throw new ApiError("INVENTORY_SKU_EXISTS", 409);
    throw error;
  });
  return inventoryView(result.rows[0]);
}
