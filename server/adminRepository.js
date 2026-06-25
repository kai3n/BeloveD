import { ApiError } from "./customerRepository.js";
import { query, withTransaction } from "./db.js";

const CATEGORY_PREFIX = {
  ring: "RING",
  earrings: "EAR",
  bracelet: "BR",
  necklace: "NECK",
};

function styleView(row) {
  return {
    styleCode: row.style_code,
    category: row.category,
    name: row.name || {},
    summary: row.summary || {},
    heroMedia: row.hero_media || {},
    media: row.media || [],
    supportedMetals: row.supported_metals || [],
    stoneRange: row.stone_range,
    leadTimeDays: {
      min: row.lead_time_min_days,
      max: row.lead_time_max_days,
    },
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function orderView(row) {
  return {
    orderCode: row.order_code,
    stage: row.stage,
    phase: row.phase,
    waitingOn: row.waiting_on,
    expectedCompletionAt: row.expected_completion_at,
    summary: row.summary || {},
    customer: {
      customerCode: row.customer_code,
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      locale: row.customer_locale,
    },
    intake: {
      intakeCode: row.intake_code,
      category: row.intake_category,
      styleCode: row.style_code,
      budgetMinorUnits: row.budget_minor_units,
      currency: row.currency,
      requiredDate: row.required_date,
      referenceMedia: row.reference_media || [],
      formPayload: row.form_payload || {},
    },
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

async function nextStyleCode(client, category) {
  const prefix = CATEGORY_PREFIX[category] || "STYLE";
  const { rows } = await client.query("select nextval('admin_style_code_seq') as value");
  return `${prefix}-CUSTOM-${String(rows[0].value).padStart(4, "0")}`;
}

function normalizeStylePayload(payload = {}) {
  const category = payload.category || "ring";
  if (!CATEGORY_PREFIX[category]) throw new ApiError("INVALID_STYLE_CATEGORY", 400);
  const media = Array.isArray(payload.media) ? payload.media : [];
  return {
    category,
    name: payload.name || {},
    summary: payload.summary || {},
    heroMedia: payload.heroMedia || media[0] || {},
    media,
    supportedMetals: Array.isArray(payload.supportedMetals) ? payload.supportedMetals : [],
    stoneRange: payload.stoneRange || null,
    leadTimeMinDays: Number(payload.leadTimeDays?.min ?? payload.leadTimeMinDays ?? 21),
    leadTimeMaxDays: Number(payload.leadTimeDays?.max ?? payload.leadTimeMaxDays ?? 42),
    published: Boolean(payload.published),
    sortOrder: Number(payload.sortOrder ?? 100),
  };
}

export async function listAdminStyles() {
  const { rows } = await query(
    `
      select *
      from starter_designs
      order by sort_order asc, updated_at desc, style_code asc
    `,
  );
  return rows.map(styleView);
}

export async function upsertAdminStyle(styleCode, payload = {}) {
  return withTransaction(async (client) => {
    const style = normalizeStylePayload(payload);
    const code = styleCode || payload.styleCode || await nextStyleCode(client, style.category);
    const { rows } = await client.query(
      `
        insert into starter_designs (
          style_code, category, name, summary, hero_media, media, supported_metals,
          stone_range, lead_time_min_days, lead_time_max_days, published, sort_order
        ) values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12
        )
        on conflict (style_code) do update set
          category = excluded.category,
          name = excluded.name,
          summary = excluded.summary,
          hero_media = excluded.hero_media,
          media = excluded.media,
          supported_metals = excluded.supported_metals,
          stone_range = excluded.stone_range,
          lead_time_min_days = excluded.lead_time_min_days,
          lead_time_max_days = excluded.lead_time_max_days,
          published = excluded.published,
          sort_order = excluded.sort_order,
          updated_at = now()
        returning *
      `,
      [
        code,
        style.category,
        JSON.stringify(style.name),
        JSON.stringify(style.summary),
        JSON.stringify(style.heroMedia),
        JSON.stringify(style.media),
        style.supportedMetals,
        style.stoneRange,
        style.leadTimeMinDays,
        style.leadTimeMaxDays,
        style.published,
        style.sortOrder,
      ],
    );
    await client.query(
      `
        insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, after_json)
        values ('admin', 'api', 'starter_design', $1, 'upsert', $2)
      `,
      [code, rows[0]],
    );
    return styleView(rows[0]);
  });
}

export async function deleteAdminStyle(styleCode) {
  const { rows } = await query("delete from starter_designs where style_code = $1 returning *", [styleCode]);
  if (!rows[0]) throw new ApiError("STYLE_NOT_FOUND", 404);
  return { deleted: true, styleCode };
}

export async function listAdminOrders() {
  const { rows } = await query(
    `
      select
        o.*,
        c.customer_code,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.locale as customer_locale,
        i.intake_code,
        i.category as intake_category,
        i.style_code,
        i.budget_minor_units,
        i.currency,
        i.required_date,
        i.reference_media,
        i.form_payload
      from customer_orders o
      join customers c on c.id = o.customer_id
      join customer_intakes i on i.id = o.intake_id
      order by o.updated_at desc
    `,
  );
  return rows.map(orderView);
}

export async function getAdminOrder(orderCode) {
  const { rows } = await query(
    `
      select
        o.*,
        c.customer_code,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.locale as customer_locale,
        i.intake_code,
        i.category as intake_category,
        i.style_code,
        i.budget_minor_units,
        i.currency,
        i.required_date,
        i.reference_media,
        i.form_payload
      from customer_orders o
      join customers c on c.id = o.customer_id
      join customer_intakes i on i.id = o.intake_id
      where o.order_code = $1
    `,
    [orderCode],
  );
  if (!rows[0]) throw new ApiError("ORDER_NOT_FOUND", 404);
  return orderView(rows[0]);
}

export async function updateAdminOrder(orderCode, payload = {}) {
  const updates = [];
  const params = [orderCode];
  const add = (sql, value) => {
    params.push(value);
    updates.push(`${sql} = $${params.length}`);
  };
  if (payload.stage) add("stage", payload.stage);
  if (payload.phase) add("phase", payload.phase);
  if (payload.waitingOn) add("waiting_on", payload.waitingOn);
  if (payload.expectedCompletionAt !== undefined) add("expected_completion_at", payload.expectedCompletionAt || null);
  if (payload.summary) add("summary", JSON.stringify(payload.summary));
  if (updates.length === 0) return getAdminOrder(orderCode);
  const { rows } = await query(
    `
      update customer_orders
      set ${updates.join(", ")}, updated_at = now()
      where order_code = $1
      returning order_code
    `,
    params,
  );
  if (!rows[0]) throw new ApiError("ORDER_NOT_FOUND", 404);
  return getAdminOrder(orderCode);
}

export async function deleteAdminOrder(orderCode) {
  const { rows } = await query("delete from customer_orders where order_code = $1 returning order_code", [orderCode]);
  if (!rows[0]) throw new ApiError("ORDER_NOT_FOUND", 404);
  return { deleted: true, orderCode };
}

export async function createAdminUploadSession(payload = {}) {
  const { rows } = await query("select nextval('media_code_seq') as value");
  const mediaCode = `MED-${String(rows[0].value).padStart(6, "0")}`;
  const storageKey = `admin/${mediaCode}`;
  await query(
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
    uploadUrl: `/v1/admin/media/${mediaCode}/mock-upload`,
    method: "PUT",
    expiresInSeconds: 900,
  };
}
