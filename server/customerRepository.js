import { createHash } from "node:crypto";
import { query, withTransaction } from "./db.js";

export class ApiError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const sequenceByPrefix = {
  CUS: "customer_code_seq",
  IN: "intake_code_seq",
  BD: "order_code_seq",
  ACT: "action_code_seq",
  ART: "artifact_code_seq",
  TL: "timeline_code_seq",
  MED: "media_code_seq",
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicCode(prefix, value) {
  return `${prefix}-${String(value).padStart(6, "0")}`;
}

async function nextCode(client, prefix) {
  const sequence = sequenceByPrefix[prefix];
  if (!sequence) throw new ApiError("BAD_CODE_PREFIX", 500);
  const { rows } = await client.query(`select nextval('${sequence}') as value`);
  return publicCode(prefix, rows[0].value);
}

function moneyToMinorUnits(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function styleView(row) {
  return {
    styleCode: row.style_code,
    category: row.category,
    name: row.name,
    summary: row.summary,
    heroMedia: row.hero_media,
    media: row.media,
    supportedMetals: row.supported_metals,
    stoneRange: row.stone_range,
    leadTimeDays: {
      min: row.lead_time_min_days,
      max: row.lead_time_max_days,
    },
  };
}

function actionView(row) {
  if (!row) return null;
  return {
    id: row.action_code,
    kind: row.kind,
    status: row.status,
    title: row.title,
    description: row.description,
    subjectType: row.subject_type,
    subjectVersionId: row.subject_version_id,
    dueAt: row.due_at,
    allowedResponses: row.allowed_responses || [],
  };
}

function artifactView(row) {
  return {
    id: row.artifact_code,
    type: row.type,
    versionLabel: row.version_label,
    publishedAt: row.published_at,
    media: row.media || [],
    payload: row.payload || {},
  };
}

function timelineView(row) {
  return {
    id: row.event_code,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    payload: row.payload || {},
  };
}

function phaseViews(stage) {
  const keys = [
    ["DEFINE", "Define your piece"],
    ["APPROVE_DESIGN", "Approve the design"],
    ["MAKING", "We are making it"],
    ["DELIVERY", "Complete and deliver"],
  ];
  const activeIndex = stage === "CANCELLED"
    ? -1
    : stage === "DELIVERED"
      ? 3
      : stage === "DEPOSIT" || stage === "CAD"
        ? 1
        : stage === "PRODUCTION" || stage === "FINAL_QC"
          ? 2
          : stage === "BALANCE" || stage === "SHIPPING"
            ? 3
            : 0;

  return keys.map(([key, title], index) => ({
    key,
    title,
    state: stage === "CANCELLED" ? "blocked" : index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming",
  }));
}

function orderSummaryView(row, nextAction = null) {
  return {
    orderCode: row.order_code,
    stage: row.stage,
    phase: row.phase,
    waitingOn: row.waiting_on,
    expectedCompletionAt: row.expected_completion_at,
    updatedAt: row.updated_at,
    summary: row.summary || {},
    nextAction,
  };
}

async function upsertCustomer(client, { email, name, phone, locale = "en" }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new ApiError("CUSTOMER_EMAIL_REQUIRED");
  const customerCode = await nextCode(client, "CUS");
  const { rows } = await client.query(
    `
      insert into customers (customer_code, email, name, phone, locale)
      values ($1, $2, $3, $4, $5)
      on conflict (email) do update set
        name = coalesce(nullif(excluded.name, ''), customers.name),
        phone = coalesce(excluded.phone, customers.phone),
        locale = excluded.locale,
        updated_at = now()
      returning *
    `,
    [customerCode, normalizedEmail, name || normalizedEmail, phone || null, locale],
  );
  return rows[0];
}

export async function listPublishedStyles() {
  const { rows } = await query(
    `
      select *
      from starter_designs
      where published = true
      order by sort_order asc, style_code asc
    `,
  );
  return rows.map(styleView);
}

export async function getPublishedStyle(styleCode) {
  const { rows } = await query(
    "select * from starter_designs where style_code = $1 and published = true",
    [styleCode],
  );
  if (!rows[0]) throw new ApiError("STYLE_NOT_FOUND", 404);
  return styleView(rows[0]);
}

export async function createDraftIntake(payload = {}) {
  return withTransaction(async (client) => {
    const contactEmail = normalizeEmail(payload.contactEmail || payload.email);
    const customer = contactEmail
      ? await upsertCustomer(client, {
        email: contactEmail,
        name: payload.name || payload.customerName || "",
        phone: payload.contactPhone || payload.phone || "",
        locale: payload.locale || "en",
      })
      : null;
    const intakeCode = await nextCode(client, "IN");
    const { rows } = await client.query(
      `
        insert into customer_intakes (
          intake_code, customer_id, entry_mode, category, product_line, style_code,
          locale, customer_name, contact_email, contact_phone, budget_minor_units,
          currency, required_date, delivery_country, form_payload, reference_media
        ) values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16
        )
        returning *
      `,
      [
        intakeCode,
        customer?.id || null,
        payload.entryMode || (payload.styleCode ? "design" : "help_me_choose"),
        payload.category || null,
        payload.productLine || null,
        payload.styleCode || null,
        payload.locale || "en",
        payload.name || payload.customerName || null,
        contactEmail || null,
        payload.contactPhone || payload.phone || null,
        moneyToMinorUnits(payload.budget),
        payload.currency || "USD",
        payload.requiredDate || null,
        payload.deliveryCountry || payload.country || null,
        payload,
        payload.referenceMedia || [],
      ],
    );
    return intakeView(rows[0]);
  });
}

function intakeView(row) {
  return {
    intakeId: row.intake_code,
    status: row.status,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export async function updateDraftIntake(intakeCode, payload = {}) {
  const { rows } = await query(
    `
      update customer_intakes
      set
        category = coalesce($2, category),
        product_line = coalesce($3, product_line),
        style_code = coalesce($4, style_code),
        customer_name = coalesce($5, customer_name),
        contact_email = coalesce($6, contact_email),
        contact_phone = coalesce($7, contact_phone),
        budget_minor_units = coalesce($8, budget_minor_units),
        required_date = coalesce($9, required_date),
        delivery_country = coalesce($10, delivery_country),
        form_payload = form_payload || $11::jsonb,
        reference_media = coalesce($12::jsonb, reference_media),
        version = version + 1,
        updated_at = now()
      where intake_code = $1 and status = 'draft'
      returning *
    `,
    [
      intakeCode,
      payload.category || null,
      payload.productLine || null,
      payload.styleCode || null,
      payload.name || payload.customerName || null,
      normalizeEmail(payload.contactEmail || payload.email) || null,
      payload.contactPhone || payload.phone || null,
      moneyToMinorUnits(payload.budget),
      payload.requiredDate || null,
      payload.deliveryCountry || payload.country || null,
      JSON.stringify(payload),
      payload.referenceMedia ? JSON.stringify(payload.referenceMedia) : null,
    ],
  );
  if (!rows[0]) throw new ApiError("INTAKE_NOT_FOUND", 404);
  return intakeView(rows[0]);
}

export async function submitIntake(intakeCode) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "select * from customer_intakes where intake_code = $1 for update",
      [intakeCode],
    );
    const intake = rows[0];
    if (!intake) throw new ApiError("INTAKE_NOT_FOUND", 404);

    const existing = await client.query(
      "select * from customer_orders where intake_id = $1",
      [intake.id],
    );
    if (existing.rows[0]) return orderSummaryView(existing.rows[0]);

    const email = normalizeEmail(intake.contact_email || intake.form_payload?.contactEmail || intake.form_payload?.email);
    const customer = intake.customer_id
      ? (await client.query("select * from customers where id = $1", [intake.customer_id])).rows[0]
      : await upsertCustomer(client, {
        email,
        name: intake.customer_name || intake.form_payload?.name || email,
        phone: intake.contact_phone || intake.form_payload?.phone || "",
        locale: intake.locale,
      });

    if (!customer) throw new ApiError("CUSTOMER_EMAIL_REQUIRED");

    const orderCode = await nextCode(client, "BD");
    const timelineCode = await nextCode(client, "TL");
    const summary = {
      category: intake.category,
      styleCode: intake.style_code,
      metal: intake.form_payload?.metal,
      heroMedia: intake.form_payload?.heroMedia,
      measurements: intake.form_payload?.conditional || {},
    };
    const orderResult = await client.query(
      `
        insert into customer_orders (
          order_code, customer_id, intake_id, stage, phase, waiting_on, summary
        ) values ($1, $2, $3, 'OPS_REVIEW', 'DEFINE', 'BELOVEDIAMOND', $4)
        returning *
      `,
      [orderCode, customer.id, intake.id, summary],
    );
    const order = orderResult.rows[0];

    await client.query(
      `
        insert into customer_timeline_events (event_code, order_id, title, body)
        values ($1, $2, $3, $4)
      `,
      [timelineCode, order.id, "Request received", "We are reviewing your custom request."],
    );
    await client.query(
      "update customer_intakes set customer_id = $1, status = 'submitted', submitted_at = now(), updated_at = now() where id = $2",
      [customer.id, intake.id],
    );
    await client.query(
      `
        insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, after_json)
        values ('customer', $1, 'order', $2, 'created', $3)
      `,
      [customer.customer_code, orderCode, order],
    );

    return orderSummaryView(order);
  });
}

async function requireCustomerByEmail(client, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new ApiError("CUSTOMER_AUTH_REQUIRED", 401);
  const { rows } = await client.query("select * from customers where email = $1", [normalizedEmail]);
  if (!rows[0]) throw new ApiError("CUSTOMER_AUTH_REQUIRED", 401);
  return rows[0];
}

export async function listCustomerOrders(email) {
  return withTransaction(async (client) => {
    const customer = await requireCustomerByEmail(client, email);
    const { rows } = await client.query(
      `
        select o.*, a.action_code, a.kind, a.status as action_status, a.title, a.description,
               a.subject_type, a.subject_version_id, a.due_at, a.allowed_responses
        from customer_orders o
        left join customer_actions a on a.id = o.next_action_id
        where o.customer_id = $1
        order by o.updated_at desc
      `,
      [customer.id],
    );
    return rows.map((row) => orderSummaryView(row, row.action_code ? actionView({
      action_code: row.action_code,
      kind: row.kind,
      status: row.action_status,
      title: row.title,
      description: row.description,
      subject_type: row.subject_type,
      subject_version_id: row.subject_version_id,
      due_at: row.due_at,
      allowed_responses: row.allowed_responses,
    }) : null));
  });
}

export async function getCustomerOrder(orderCode, email) {
  return withTransaction(async (client) => {
    const customer = await requireCustomerByEmail(client, email);
    const orderResult = await client.query(
      "select * from customer_orders where order_code = $1 and customer_id = $2",
      [orderCode, customer.id],
    );
    const order = orderResult.rows[0];
    if (!order) throw new ApiError("ORDER_ACCESS_DENIED", 403);

    const [actions, artifacts, timeline] = await Promise.all([
      client.query("select * from customer_actions where order_id = $1 order by created_at desc", [order.id]),
      client.query("select * from published_artifacts where order_id = $1 order by published_at desc", [order.id]),
      client.query("select * from customer_timeline_events where order_id = $1 and visibility = 'customer' order by created_at desc", [order.id]),
    ]);
    const nextAction = actions.rows.find((row) => row.id === order.next_action_id) || actions.rows.find((row) => row.status === "OPEN");

    return {
      ...orderSummaryView(order, actionView(nextAction)),
      phases: phaseViews(order.stage),
      publishedArtifacts: artifacts.rows.map(artifactView),
      timeline: timeline.rows.map(timelineView),
    };
  });
}

export async function listOrderActions(orderCode, email) {
  const order = await getCustomerOrder(orderCode, email);
  return {
    orderCode: order.orderCode,
    actions: [order.nextAction, ...[]].filter(Boolean),
  };
}

export async function respondToAction(actionCode, email, payload = {}) {
  return withTransaction(async (client) => {
    const customer = await requireCustomerByEmail(client, email);
    const { rows } = await client.query(
      `
        select a.*, o.customer_id, o.order_code
        from customer_actions a
        join customer_orders o on o.id = a.order_id
        where a.action_code = $1
        for update
      `,
      [actionCode],
    );
    const action = rows[0];
    if (!action || action.customer_id !== customer.id) throw new ApiError("ORDER_ACCESS_DENIED", 403);
    if (action.status !== "OPEN") throw new ApiError("ACTION_STALE", 409);
    if (payload.expectedSubjectVersionId && payload.expectedSubjectVersionId !== action.subject_version_id) {
      throw new ApiError("ACTION_STALE", 409);
    }

    const response = payload.response;
    if (response && action.allowed_responses.length > 0 && !action.allowed_responses.includes(response)) {
      throw new ApiError("INVALID_ACTION_RESPONSE", 400);
    }

    await client.query(
      `
        update customer_actions
        set status = 'RESPONDED', response_payload = $2, responded_at = now(), updated_at = now()
        where id = $1
      `,
      [action.id, payload],
    );
    await client.query(
      `
        update customer_orders
        set waiting_on = 'BELOVEDIAMOND', next_action_id = null, updated_at = now()
        where id = $1
      `,
      [action.order_id],
    );
    await client.query(
      `
        insert into customer_timeline_events (event_code, order_id, title, body)
        values ($1, $2, $3, $4)
      `,
      [await nextCode(client, "TL"), action.order_id, "Response received", action.title],
    );
    return { actionId: actionCode, status: "RESPONDED" };
  });
}

export async function createUploadSession(payload = {}) {
  return withTransaction(async (client) => {
    const mediaCode = await nextCode(client, "MED");
    const storageKey = `customer/${mediaCode}`;
    await client.query(
      `
        insert into media_assets (media_code, kind, mime_type, byte_size, storage_key, public_payload)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        mediaCode,
        payload.kind || "image",
        payload.mimeType || "application/octet-stream",
        payload.byteSize || null,
        storageKey,
        { fileName: payload.fileName || null },
      ],
    );
    return {
      mediaId: mediaCode,
      uploadUrl: `/v1/customer/media/${mediaCode}/mock-upload`,
      method: "PUT",
      expiresInSeconds: 900,
    };
  });
}

export function requestHash(body) {
  return createHash("sha256").update(JSON.stringify(body || {})).digest("hex");
}

export async function runIdempotent(route, key, hash, fn) {
  if (!key) throw new ApiError("IDEMPOTENCY_KEY_REQUIRED", 400);
  return withTransaction(async (client) => {
    const existing = await client.query(
      "select * from idempotency_keys where route = $1 and idempotency_key = $2",
      [route, key],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== hash) throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
      return {
        statusCode: existing.rows[0].status_code,
        body: existing.rows[0].response_json,
      };
    }

    const result = await fn(client);
    await client.query(
      `
        insert into idempotency_keys (route, idempotency_key, request_hash, status_code, response_json)
        values ($1, $2, $3, $4, $5)
      `,
      [route, key, hash, result.statusCode || 200, result.body || result],
    );
    return {
      statusCode: result.statusCode || 200,
      body: result.body || result,
    };
  });
}
