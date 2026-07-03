import { createHash } from "node:crypto";
import { query, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";

export { ApiError }; // adminRepository 등 기존 import 경로 호환

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

// 3단계 여정 — 디자인 승인 스텝은 제품 flow에서 제거됨(초안 수락=디자인 승인)이라 별도 단계로 두지 않는다
function phaseViews(stage) {
  const keys = [
    ["DEFINE", "Define your piece"],
    ["MAKING", "We are making it"],
    ["DELIVERY", "Complete and deliver"],
  ];
  const activeIndex = stage === "CANCELLED"
    ? -1
    : stage === "DELIVERED"
      ? 2
      // DEPOSIT(디파짓 대기)은 아직 '피스 확정' 단계 — 제작은 입금 확인부터
      : ["CAD", "PRODUCTION", "FINAL_QC"].includes(stage)
        ? 1
        : stage === "BALANCE" || stage === "SHIPPING"
          ? 2
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
        // 왜: node-pg는 JS 배열을 Postgres 배열 리터럴로 직렬화한다 — jsonb 컬럼엔
        // 반드시 stringify (비어있지 않은 referenceMedia가 통째로 500 나던 버그)
        JSON.stringify(payload.referenceMedia || []),
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
    if (existing.rows[0]) {
      const c = (await client.query("select email, locale from customers where id = $1", [existing.rows[0].customer_id])).rows[0];
      return { ...orderSummaryView(existing.rows[0]), created: false, notify: { email: c.email, locale: c.locale } };
    }

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

    return { ...orderSummaryView(order), created: true, notify: { email: customer.email, locale: customer.locale } };
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
      // 응답 이력 요약 — 포털이 "승인됨 → 디파짓 단계" 같은 상태를 도출하는 데 쓴다 (created_at desc)
      actions: actions.rows.map((row) => ({
        kind: row.kind,
        status: row.status,
        response: row.response_payload?.response || null,
        respondedAt: row.responded_at,
      })),
    };
  });
}

// 고객 배송지 저장 — customer_orders.summary.shippingAddress (어드민 상세에도 그대로 노출)
const SHIPPING_FIELDS = ["recipientName", "phone", "addressLine1", "addressLine2", "city", "region", "postalCode", "country", "notes"];
export async function updateOrderShippingAddress(orderCode, email, address = {}) {
  return withTransaction(async (client) => {
    const customer = await requireCustomerByEmail(client, email);
    const { rows } = await client.query(
      "select id, summary from customer_orders where order_code = $1 and customer_id = $2 for update",
      [orderCode, customer.id],
    );
    const order = rows[0];
    if (!order) throw new ApiError("ORDER_ACCESS_DENIED", 403);
    const clean = {};
    for (const key of SHIPPING_FIELDS) clean[key] = String(address[key] || "").slice(0, 200);
    await client.query(
      "update customer_orders set summary = coalesce(summary, '{}'::jsonb) || $2::jsonb, updated_at = now() where id = $1",
      [order.id, JSON.stringify({ shippingAddress: clean })],
    );
    // 타임라인은 최초 저장에만 — 주소 수정 반복이 이벤트 스팸이 되지 않게
    if (!order.summary?.shippingAddress) {
      await client.query(
        `insert into customer_timeline_events (event_code, order_id, title, body, payload)
         values ($1, $2, $3, $4, $5)`,
        [await nextCode(client, "TL"), order.id, "shipping_address_confirmed", null, { type: "shipping_address_confirmed" }],
      );
    }
    return { ok: true, shippingAddress: clean };
  });
}

// 고객 송금 셀프 리포트 (deposit|balance) — 타임라인 기록 + 공은 BeloveD로
export async function reportOrderPayment(orderCode, email, kind) {
  const paymentKind = kind === "balance" ? "balance" : "deposit";
  return withTransaction(async (client) => {
    const customer = await requireCustomerByEmail(client, email);
    const { rows } = await client.query(
      "select id, stage from customer_orders where order_code = $1 and customer_id = $2 for update",
      [orderCode, customer.id],
    );
    const order = rows[0];
    if (!order) throw new ApiError("ORDER_ACCESS_DENIED", 403);
    await client.query(
      `insert into customer_timeline_events (event_code, order_id, title, body, payload)
       values ($1, $2, $3, $4, $5)`,
      [await nextCode(client, "TL"), order.id, "payment_reported", null, { type: "payment_reported", data: { kind: paymentKind } }],
    );
    await client.query(
      "update customer_orders set waiting_on = 'BELOVEDIAMOND', updated_at = now() where id = $1",
      [order.id],
    );
    return { ok: true, kind: paymentKind };
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
    // 제안 승인 → stage QUOTE→DEPOSIT 전이(디파짓 대기), 다음 수는 고객. 그 외 응답은 BeloveD 차례.
    const quoteApproved = action.kind === "QUOTE_ACCEPTANCE" && response === "APPROVE";
    if (quoteApproved) {
      await client.query(
        `
          update customer_orders
          set stage = 'DEPOSIT', waiting_on = 'CUSTOMER', next_action_id = null, updated_at = now()
          where id = $1
        `,
        [action.order_id],
      );
    } else {
      await client.query(
        `
          update customer_orders
          set waiting_on = 'BELOVEDIAMOND', next_action_id = null, updated_at = now()
          where id = $1
        `,
        [action.order_id],
      );
    }
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

// 주문 상태 이벤트 — 스펙 §2 전이 표. received는 인테이크 제출이 자동 기록(라우트는 거부).
export const EVENT_TRANSITIONS = {
  received: { stage: "OPS_REVIEW", phase: "DEFINE", waitingOn: "BELOVEDIAMOND" },
  proposal_sent: { stage: "QUOTE", phase: "DEFINE", waitingOn: "CUSTOMER" },
  deposit_confirmed: { stage: "CAD", phase: "APPROVE_DESIGN", waitingOn: "BELOVEDIAMOND" },
  diamond_locked: { stage: "CAD", phase: "APPROVE_DESIGN", waitingOn: "BELOVEDIAMOND" },
  cad_ready: { stage: "CAD", phase: "APPROVE_DESIGN", waitingOn: "CUSTOMER" },
  production_started: { stage: "PRODUCTION", phase: "MAKING", waitingOn: "BELOVEDIAMOND" },
  qc_ready: { stage: "FINAL_QC", phase: "MAKING", waitingOn: "CUSTOMER" },
  balance_requested: { stage: "BALANCE", phase: "DELIVERY", waitingOn: "CUSTOMER" },
  shipped: { stage: "SHIPPING", phase: "DELIVERY", waitingOn: "EXTERNAL" },
  delivered: { stage: "DELIVERED", phase: "CLOSED", waitingOn: "NONE" },
};

// 이벤트에 실어 보낼 수 있는 발행물 — 스키마 check 제약과 동일 목록 (사전 검증으로 500 대신 400)
const ARTIFACT_TYPES = new Set(["REFERENCE", "DIAMOND_OPTION", "QUOTE", "CAD", "QC", "CERTIFICATE", "SHIPMENT"]);
const ACTION_KINDS = new Set([
  "DIAMOND_SELECTION", "QUOTE_ACCEPTANCE", "CAD_REVIEW", "FINAL_WEIGHT_ACCEPTANCE",
  "FINAL_QC_CONFIRMATION", "DELIVERY_ADDRESS",
]);

// extras.artifact: 고객 포털에 공개할 미디어/페이로드, extras.action: 열릴 고객 컨펌.
// 같은 트랜잭션에서 stage 전이와 함께 원자적으로 발행된다 — 절반만 적용되는 상태 없음.
export async function recordOrderEvent(orderCode, type, data = {}, extras = {}) {
  // 왜: EVENT_TRANSITIONS[type]는 상속된 Object.prototype 속성명("toString" 등)도 truthy로 통과시킨다 — own-property로만 검사
  const transition = Object.hasOwn(EVENT_TRANSITIONS, type) ? EVENT_TRANSITIONS[type] : null;
  if (!transition) throw new ApiError("VALIDATION_ERROR", 400, `unknown event type: ${type}`);
  if (extras.artifact && !ARTIFACT_TYPES.has(extras.artifact.type)) {
    throw new ApiError("VALIDATION_ERROR", 400, "unknown artifact type");
  }
  if (extras.action && !ACTION_KINDS.has(extras.action.kind)) {
    throw new ApiError("VALIDATION_ERROR", 400, "unknown action kind");
  }
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `select o.*, c.email, c.locale from customer_orders o
       join customers c on c.id = o.customer_id
       where o.order_code = $1 for update of o`,
      [orderCode],
    );
    const order = rows[0];
    if (!order) throw new ApiError("NOT_FOUND", 404);
    const eventCode = await nextCode(client, "TL");
    await client.query(
      `insert into customer_timeline_events (event_code, order_id, title, body, payload)
       values ($1, $2, $3, $4, $5)`,
      [eventCode, order.id, type, null, { type, data }],
    );
    await client.query(
      `update customer_orders set stage = $2, phase = $3, waiting_on = $4, updated_at = now()
       where id = $1`,
      [order.id, transition.stage, transition.phase, transition.waitingOn],
    );

    let artifactCode = null;
    if (extras.artifact) {
      const a = extras.artifact;
      artifactCode = await nextCode(client, "ART");
      await client.query(
        `insert into published_artifacts (artifact_code, order_id, type, version_label, subject_version_id, payload, media)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [artifactCode, order.id, a.type, a.versionLabel || "V1", a.subjectVersionId || artifactCode,
          a.payload || {}, JSON.stringify(a.media || [])],
      );
    }

    let actionCode = null;
    if (extras.action) {
      const act = extras.action;
      // 한 번에 열린 컨펌은 하나 — 이전 열린 액션은 취소하고 새 액션을 다음 액션으로 지정
      await client.query(
        "update customer_actions set status = 'CANCELLED', updated_at = now() where order_id = $1 and status = 'OPEN'",
        [order.id],
      );
      actionCode = await nextCode(client, "ACT");
      const inserted = await client.query(
        `insert into customer_actions (action_code, order_id, kind, title, description, subject_type, subject_version_id, due_at, allowed_responses)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id`,
        [actionCode, order.id, act.kind, act.title || type, act.description || null,
          act.subjectType || extras.artifact?.type || "ORDER",
          act.subjectVersionId || artifactCode || orderCode,
          act.dueAt || null, act.allowedResponses || []],
      );
      await client.query(
        "update customer_orders set next_action_id = $2, updated_at = now() where id = $1",
        [order.id, inserted.rows[0].id],
      );
    }

    await client.query(
      `insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
       values ('admin', null, 'order', $1, $2, $3, $4)`,
      [orderCode, `event:${type}`, { stage: order.stage }, { stage: transition.stage, data, artifactCode, actionCode }],
    );
    return {
      orderCode, stage: transition.stage, eventId: eventCode, artifactCode, actionCode,
      notify: { email: order.email, locale: order.locale },
    };
  });
}

// 어드민 실주문 콘솔 — 서버 주문 목록. 어드민 전용이라 고객 이메일 노출 허용.
// 최근 갱신 순, 진행 중 주문을 위로 (CLOSED/CANCELLED는 뒤).
export async function listServerOrders({ limit = 100 } = {}) {
  const { rows } = await query(
    `select o.order_code, o.stage, o.phase, o.waiting_on, o.created_at, o.updated_at, o.summary,
            c.name as customer_name, c.email as customer_email, c.locale,
            (
              select (pa.payload->>'totalUsd')::numeric
              from published_artifacts pa
              where pa.order_id = o.id and pa.type = 'QUOTE' and pa.payload ? 'totalUsd'
              order by pa.published_at desc
              limit 1
            ) as total_usd
     from customer_orders o
     join customers c on c.id = o.customer_id
     order by (o.phase = 'CLOSED' or o.stage = 'CANCELLED'), o.updated_at desc
     limit $1`,
    [Math.min(Number(limit) || 100, 200)],
  );
  return rows.map((r) => ({
    orderCode: r.order_code,
    stage: r.stage,
    phase: r.phase,
    waitingOn: r.waiting_on,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    summary: r.summary || {},
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    locale: r.locale,
    // 최신 QUOTE 아티팩트의 총액 — Past Orders 매출 집계용 (견적 전 주문은 null)
    totalUsd: r.total_usd === null ? null : Number(r.total_usd),
  }));
}
