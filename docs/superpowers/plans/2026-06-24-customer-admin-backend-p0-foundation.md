# P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation — PostgreSQL migrations, real session auth (guest + magic link + password + admin), an Express API skeleton on a single origin — and prepare the frontend (API client, auth rewire) while removing all vendor/dealer/supplier code.

**Architecture:** One Node/Express process serves the built Vite SPA and a `/v1/*` JSON API on the same origin; PostgreSQL via `pg`. Auth uses opaque DB-backed sessions in an HttpOnly cookie. Passwords use Node's built-in `scrypt` (zero native deps). Magic-link tokens are stored as SHA-256 hashes. Email/payment/media are behind seams; in dev the magic link is returned to the client.

**Tech Stack:** Node 20+ (ESM), Express, `pg`, `cookie-parser`, built-in `node:crypto` (scrypt, randomBytes, sha256), Vitest + Supertest (backend tests against a real test database), Vite (SPA, dev proxy).

## Global Constraints

- The browser never talks to PostgreSQL directly; only `/v1/*` JSON. (HLD invariant #1)
- No vendor/dealer/supplier code, routes, schemas, or strings anywhere in the bundle. (HLD invariant #14)
- All SQL uses parameter binding — never string-interpolate user input.
- Customer identity comes from the session, never from a request header.
- A customer can read only orders they own; enforced server-side on every order read. (HLD invariant #4)
- Session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` only when `NODE_ENV==='production'`.
- Money is integer minor units + ISO currency code (no floats for money).
- Public/display codes (e.g. `BD-000142`) are identifiers, not auth secrets.
- Keep the existing flat `server/` layout; add files alongside, don't restructure into deep folders.
- Do NOT modify `server/customerRepository.js` or `server/adminRepository.js` in P0 — they are rewritten in P1/P2. P0's Express app does not import them.

---

## File Structure

**Backend (create):**
- `server/lib-note` → (no folder) all new modules are flat under `server/`
- `server/errors.js` — `ApiError` + stable error codes (fresh; P0 code uses this, not the repo copy)
- `server/codes.js` — sequence-based public code generation
- `server/passwords.js` — scrypt hash/verify
- `server/session.js` — DB session issue/get/revoke + `hashToken`
- `server/mailer.js` — dev mail sink seam
- `server/auth.js` — auth domain: magic link create/verify, password login, admin login, ensure-customer
- `server/middleware.js` — cookie→session resolution, `requireCustomer`, `requireAdmin`
- `server/authRoutes.js` — `/v1/auth/*` route handlers (Express router)
- `server/app.js` — Express app factory (middleware + routers + static SPA + error handler)
- `server/seedAdmin.js` — seed a dev admin account
- `server/__tests__/setup.js` — vitest setup: migrate test DB, close pool
- `server/__tests__/helpers.js` — `truncateAuth()`, `withApp()` supertest helper
- `vitest.server.config.js` — node-environment vitest config for backend
- `.env.test` — test DB connection string

**Backend (modify):**
- `server/db.js` — make the Pool lazy (env set before first use)
- `server/migrate.js` — auto-discover `db/migrations/*.sql`; export `migrate()`
- `server/index.js` — replace raw `http` server with Express app from `app.js`
- `db/migrations/0003_auth.sql` — sessions, magic_link_tokens, admin_users, customers.password_hash
- `package.json` — deps + scripts
- `vite.config.js` — dev proxy `/v1` → API

**Frontend (modify/delete):**
- Delete: `src/pages/dealer/`, `src/pages/supplier/`, `src/pages/VendorLogin.jsx`, `src/pages/DealerApply.jsx`, `src/pages/Diamonds.jsx`, `src/pages/DiamondDetail.jsx`, `src/dealerStrings.js`, `src/lib/dealer.js`, and their tests
- Create: `src/lib/api/client.js` — fetch wrapper (credentials, idempotency, error mapping)
- Modify: `src/lib/auth.jsx` — session + magic link + guest; `src/App.jsx` — drop dead routes; `src/lib/store.js` — remove dealer/vendor exports

---

## Prerequisite: create databases (run once, manually)

```bash
createdb belovediamond 2>/dev/null || true
createdb belovediamond_test 2>/dev/null || true
```
Expected: two databases exist (or already existed). If `createdb` is unavailable, create them via `psql -c "create database belovediamond;"`.

---

### Task 1: Lazy DB pool, migration runner auto-discovery, deps

**Files:**
- Modify: `server/db.js`
- Modify: `server/migrate.js`
- Modify: `package.json`
- Create: `vitest.server.config.js`
- Create: `.env.test`
- Create: `server/__tests__/setup.js`
- Test: `server/__tests__/migrate.test.js`

**Interfaces:**
- Produces: `query(text, params)`, `withTransaction(fn)`, `closePool()` from `./db.js`; `migrate()` from `./migrate.js`.

- [ ] **Step 1: Add dependencies and scripts**

Run:
```bash
npm install express@^4 cookie-parser@^1 && npm install -D supertest@^7
```
Then edit `package.json` `scripts` to add:
```json
"test:server": "vitest run -c vitest.server.config.js",
"start": "node server/index.js"
```

- [ ] **Step 2: Make the pool lazy in `server/db.js`**

Replace the whole file with:
```js
import { Pool } from "pg";

let _pool;
export function pool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/belovediamond",
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
    });
  }
  return _pool;
}

export async function query(text, params = []) {
  return pool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (_pool) { await _pool.end(); _pool = undefined; }
}
```

- [ ] **Step 3: Rewrite `server/migrate.js` to auto-discover migrations**

Replace the whole file with:
```js
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { query, withTransaction, closePool } from "./db.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

async function ensureTable() {
  await query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now())`);
}

export async function migrate() {
  await ensureTable();
  const { rows } = await query("select filename from schema_migrations");
  const done = new Set(rows.map((r) => r.filename));
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const filename of files) {
    if (done.has(filename)) continue;
    const sql = await readFile(join(migrationsDir, filename), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
    });
    console.log(`applied ${filename}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closePool());
}
```

- [ ] **Step 4: Create `.env.test`**

```
DATABASE_URL=postgres://localhost:5432/belovediamond_test
NODE_ENV=test
```

- [ ] **Step 5: Create `vitest.server.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.js"],
    setupFiles: ["server/__tests__/setup.js"],
    fileParallelism: false,
    hookTimeout: 30000,
  },
});
```

- [ ] **Step 6: Create `server/__tests__/setup.js`**

```js
import { beforeAll, afterAll } from "vitest";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost:5432/belovediamond_test";
process.env.NODE_ENV = "test";

const { migrate } = await import("../migrate.js");
const { closePool } = await import("../db.js");

beforeAll(async () => { await migrate(); });
afterAll(async () => { await closePool(); });
```

- [ ] **Step 7: Write the failing test `server/__tests__/migrate.test.js`**

```js
import { describe, it, expect } from "vitest";
import { query } from "../db.js";

describe("migrations", () => {
  it("applies every file in db/migrations including 0002", async () => {
    const { rows } = await query("select filename from schema_migrations order by filename");
    const files = rows.map((r) => r.filename);
    expect(files).toContain("0001_customer_core.sql");
    expect(files).toContain("0002_admin_backoffice.sql");
  });

  it("created the starter_designs table with seeded rows", async () => {
    const { rows } = await query("select count(*)::int as n from starter_designs");
    expect(rows[0].n).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 8: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/migrate.test.js`
Expected: 2 passing. (The setup file migrates the fresh test DB; both migration files are applied because the runner now auto-discovers them.)

- [ ] **Step 9: Commit**

```bash
git add server/db.js server/migrate.js package.json package-lock.json vitest.server.config.js .env.test server/__tests__/setup.js server/__tests__/migrate.test.js
git commit -m "feat(server): lazy pg pool + auto-discovering migration runner + test harness"
```

---

### Task 2: Auth migration (0003)

**Files:**
- Create: `db/migrations/0003_auth.sql`
- Test: `server/__tests__/auth-schema.test.js`

**Interfaces:**
- Produces tables: `sessions`, `magic_link_tokens`, `admin_users`; column `customers.password_hash`.

- [ ] **Step 1: Write the failing test `server/__tests__/auth-schema.test.js`**

```js
import { describe, it, expect } from "vitest";
import { query } from "../db.js";

async function columns(table) {
  const { rows } = await query(
    "select column_name from information_schema.columns where table_name=$1", [table]);
  return rows.map((r) => r.column_name);
}

describe("0003 auth schema", () => {
  it("has sessions with principal columns", async () => {
    const c = await columns("sessions");
    expect(c).toEqual(expect.arrayContaining(["id", "principal_type", "principal_id", "expires_at", "revoked_at"]));
  });
  it("has magic_link_tokens", async () => {
    const c = await columns("magic_link_tokens");
    expect(c).toEqual(expect.arrayContaining(["token_hash", "email", "intent", "expires_at", "used_at"]));
  });
  it("has admin_users", async () => {
    const c = await columns("admin_users");
    expect(c).toEqual(expect.arrayContaining(["email", "password_hash", "active"]));
  });
  it("added customers.password_hash", async () => {
    expect(await columns("customers")).toContain("password_hash");
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `npm run test:server -- server/__tests__/auth-schema.test.js`
Expected: FAIL (tables/column do not exist).

- [ ] **Step 3: Create `db/migrations/0003_auth.sql`**

```sql
create table if not exists sessions (
  id text primary key,
  principal_type text not null check (principal_type in ('customer','admin')),
  principal_id bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists sessions_principal_idx on sessions (principal_type, principal_id);

create table if not exists magic_link_tokens (
  token_hash text primary key,
  email text not null check (email = lower(email)),
  intent text not null default 'login',
  order_code text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists magic_link_email_idx on magic_link_tokens (email, created_at desc);

create table if not exists admin_users (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table customers add column if not exists password_hash text;
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/auth-schema.test.js`
Expected: 4 passing. (The setup `beforeAll` re-runs `migrate()`, which applies the new file.)

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0003_auth.sql server/__tests__/auth-schema.test.js
git commit -m "feat(db): 0003 auth migration — sessions, magic links, admin users"
```

---

### Task 3: Errors and public codes

**Files:**
- Create: `server/errors.js`
- Create: `server/codes.js`
- Test: `server/__tests__/codes.test.js`

**Interfaces:**
- Produces: `class ApiError(code, status=400, message=code)` from `./errors.js`.
- Produces: `nextCode(client, prefix)` → `"BD-000142"`; valid prefixes `CUS, IN, BD, ACT, ART, TL, MED`. From `./codes.js`.

- [ ] **Step 1: Create `server/errors.js`**

```js
export class ApiError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Stable, customer-facing error codes (HLD §12.4)
export const ERROR_CODES = [
  "EMAIL_REQUIRED", "MAGIC_LINK_INVALID", "INVALID_CREDENTIALS",
  "CUSTOMER_AUTH_REQUIRED", "ADMIN_AUTH_REQUIRED", "ORDER_ACCESS_DENIED",
  "ACTION_STALE", "ACTION_EXPIRED", "ARTIFACT_SUPERSEDED",
  "DIAMOND_SOLD", "DIAMOND_BATCH_EXPIRED", "PAYMENT_PENDING",
  "PAYMENT_ALREADY_COMPLETED", "UPLOAD_SESSION_EXPIRED", "MEDIA_PROCESSING",
  "RATE_LIMITED", "IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENCY_KEY_REUSED",
  "INVALID_JSON", "NOT_FOUND", "INTERNAL_ERROR",
];
```

- [ ] **Step 2: Create `server/codes.js`**

```js
import { ApiError } from "./errors.js";

const SEQUENCE_BY_PREFIX = {
  CUS: "customer_code_seq",
  IN: "intake_code_seq",
  BD: "order_code_seq",
  ACT: "action_code_seq",
  ART: "artifact_code_seq",
  TL: "timeline_code_seq",
  MED: "media_code_seq",
};

export async function nextCode(client, prefix) {
  const sequence = SEQUENCE_BY_PREFIX[prefix];
  if (!sequence) throw new ApiError("BAD_CODE_PREFIX", 500);
  const { rows } = await client.query(`select nextval('${sequence}') as value`);
  return `${prefix}-${String(rows[0].value).padStart(6, "0")}`;
}
```

- [ ] **Step 3: Write the failing test `server/__tests__/codes.test.js`**

```js
import { describe, it, expect } from "vitest";
import { withTransaction } from "../db.js";
import { nextCode } from "../codes.js";

describe("nextCode", () => {
  it("formats a zero-padded public code", async () => {
    const code = await withTransaction((c) => nextCode(c, "BD"));
    expect(code).toMatch(/^BD-\d{6}$/);
  });
  it("increments monotonically", async () => {
    const [a, b] = await withTransaction(async (c) => [await nextCode(c, "BD"), await nextCode(c, "BD")]);
    expect(Number(b.slice(3))).toBe(Number(a.slice(3)) + 1);
  });
});
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/codes.test.js`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add server/errors.js server/codes.js server/__tests__/codes.test.js
git commit -m "feat(server): ApiError + stable error codes + public code generator"
```

---

### Task 4: Passwords and sessions

**Files:**
- Create: `server/passwords.js`
- Create: `server/session.js`
- Test: `server/__tests__/session.test.js`

**Interfaces:**
- Produces: `hashPassword(pw) -> string`, `verifyPassword(pw, stored) -> bool` from `./passwords.js`.
- Produces: `issueSession(principalType, principalId, ttlMs?) -> {id, expiresAt}`, `getSession(id) -> row|null`, `revokeSession(id)`, `hashToken(raw) -> string` from `./session.js`.

- [ ] **Step 1: Create `server/passwords.js`**

```js
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const dk = scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(pw, stored) {
  const [scheme, saltHex, hashHex] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const dk = scryptSync(String(pw), Buffer.from(saltHex, "hex"), 64);
  const target = Buffer.from(hashHex, "hex");
  return dk.length === target.length && timingSafeEqual(dk, target);
}
```

- [ ] **Step 2: Create `server/session.js`**

```js
import { randomBytes, createHash } from "node:crypto";
import { query } from "./db.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashToken(raw) {
  return createHash("sha256").update(String(raw)).digest("hex");
}

export async function issueSession(principalType, principalId, ttlMs = DEFAULT_TTL_MS) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await query(
    "insert into sessions (id, principal_type, principal_id, expires_at) values ($1,$2,$3,$4)",
    [id, principalType, principalId, expiresAt],
  );
  return { id, expiresAt };
}

export async function getSession(id) {
  if (!id) return null;
  const { rows } = await query(
    "select * from sessions where id=$1 and revoked_at is null and expires_at > now()",
    [id],
  );
  return rows[0] || null;
}

export async function revokeSession(id) {
  if (!id) return;
  await query("update sessions set revoked_at=now() where id=$1", [id]);
}
```

- [ ] **Step 3: Write the failing test `server/__tests__/session.test.js`**

```js
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../passwords.js";
import { issueSession, getSession, revokeSession } from "../session.js";

describe("passwords", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const h = hashPassword("hunter2");
    expect(verifyPassword("hunter2", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});

describe("sessions", () => {
  it("issues a session that resolves, then revokes it", async () => {
    const { id } = await issueSession("admin", 1);
    expect((await getSession(id)).principal_type).toBe("admin");
    await revokeSession(id);
    expect(await getSession(id)).toBeNull();
  });
  it("does not resolve an expired session", async () => {
    const { id } = await issueSession("customer", 2, -1000);
    expect(await getSession(id)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/session.test.js`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add server/passwords.js server/session.js server/__tests__/session.test.js
git commit -m "feat(server): scrypt passwords + DB-backed sessions"
```

---

### Task 5: Mailer seam + auth domain

**Files:**
- Create: `server/mailer.js`
- Create: `server/auth.js`
- Test: `server/__tests__/auth.test.js`
- Test helper: `server/__tests__/helpers.js`

**Interfaces:**
- Produces: `sendMagicLink(email, link)`, `drainMail()` from `./mailer.js`.
- Produces from `./auth.js`:
  - `createMagicLink(email, { origin, intent?, orderCode? }) -> { email, link, raw, expiresAt }`
  - `verifyMagicLink(raw) -> { session:{id,expiresAt}, customer }`
  - `ensureCustomer(client, email, name?) -> customerRow`
  - `loginWithPassword(email, password) -> { principalType, session } | throws INVALID_CREDENTIALS`
  - `setCustomerPassword(customerId, password)`

- [ ] **Step 1: Create `server/__tests__/helpers.js`**

```js
import { query } from "../db.js";

export async function truncateAuth() {
  await query(`truncate table sessions, magic_link_tokens, admin_users, customers
    restart identity cascade`);
}
```

- [ ] **Step 2: Create `server/mailer.js`**

```js
// Dev seam: capture outbound mail instead of sending. Swap for SMTP/Resend in prod.
const sink = [];

export async function sendMagicLink(email, link) {
  const msg = { type: "magic_link", to: email, link, at: new Date().toISOString() };
  sink.push(msg);
  if (process.env.NODE_ENV !== "test") console.log(`[mailer] magic link → ${email}: ${link}`);
  return msg;
}

export function drainMail() {
  return sink.splice(0);
}
```

- [ ] **Step 3: Create `server/auth.js`**

```js
import { randomBytes } from "node:crypto";
import { query, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";
import { nextCode } from "./codes.js";
import { hashToken, issueSession } from "./session.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { sendMagicLink } from "./mailer.js";

const MAGIC_TTL_MS = 1000 * 60 * 15; // 15 minutes

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureCustomer(client, email, name) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new ApiError("EMAIL_REQUIRED", 400);
  const existing = await client.query("select * from customers where email=$1", [normalized]);
  if (existing.rows[0]) return existing.rows[0];
  const code = await nextCode(client, "CUS");
  const { rows } = await client.query(
    "insert into customers (customer_code, email, name) values ($1,$2,$3) returning *",
    [code, normalized, name || normalized],
  );
  return rows[0];
}

export async function createMagicLink(email, { origin, intent = "login", orderCode = null }) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new ApiError("EMAIL_REQUIRED", 400);
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS);
  await query(
    `insert into magic_link_tokens (token_hash, email, intent, order_code, expires_at)
     values ($1,$2,$3,$4,$5)`,
    [hashToken(raw), normalized, intent, orderCode, expiresAt],
  );
  const link = `${origin}/auth/callback?token=${raw}`;
  await sendMagicLink(normalized, link);
  return { email: normalized, link, raw, expiresAt };
}

export async function verifyMagicLink(raw) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "select * from magic_link_tokens where token_hash=$1 for update", [hashToken(raw)]);
    const token = rows[0];
    if (!token || token.used_at || new Date(token.expires_at) < new Date()) {
      throw new ApiError("MAGIC_LINK_INVALID", 400);
    }
    await client.query("update magic_link_tokens set used_at=now() where token_hash=$1", [hashToken(raw)]);
    const customer = await ensureCustomer(client, token.email);
    const session = await issueSession("customer", customer.id);
    return { session, customer };
  });
}

export async function loginWithPassword(email, password) {
  const normalized = normalizeEmail(email);
  const admin = await query("select * from admin_users where email=$1 and active=true", [normalized]);
  if (admin.rows[0] && verifyPassword(password, admin.rows[0].password_hash)) {
    return { principalType: "admin", session: await issueSession("admin", admin.rows[0].id) };
  }
  const cust = await query("select * from customers where email=$1", [normalized]);
  if (cust.rows[0]?.password_hash && verifyPassword(password, cust.rows[0].password_hash)) {
    return { principalType: "customer", session: await issueSession("customer", cust.rows[0].id) };
  }
  throw new ApiError("INVALID_CREDENTIALS", 401);
}

export async function setCustomerPassword(customerId, password) {
  if (!password || String(password).length < 8) throw new ApiError("INVALID_CREDENTIALS", 400, "password too short");
  await query("update customers set password_hash=$1, updated_at=now() where id=$2",
    [hashPassword(password), customerId]);
}
```

- [ ] **Step 4: Write the failing test `server/__tests__/auth.test.js`**

```js
import { describe, it, expect, beforeEach } from "vitest";
import { truncateAuth } from "./helpers.js";
import { createMagicLink, verifyMagicLink, loginWithPassword, ensureCustomer, setCustomerPassword } from "../auth.js";
import { drainMail } from "../mailer.js";
import { withTransaction, query } from "../db.js";
import { hashPassword } from "../passwords.js";
import { ApiError } from "../errors.js";

beforeEach(async () => { await truncateAuth(); drainMail(); });

describe("magic link", () => {
  it("creates a one-time link, captures mail, and logs in a new guest email", async () => {
    const { raw } = await createMagicLink("New@Example.com", { origin: "http://x" });
    expect(drainMail()).toHaveLength(1);
    const { customer, session } = await verifyMagicLink(raw);
    expect(customer.email).toBe("new@example.com");
    expect(session.id).toBeTruthy();
  });
  it("rejects reuse of a consumed token", async () => {
    const { raw } = await createMagicLink("a@b.com", { origin: "http://x" });
    await verifyMagicLink(raw);
    await expect(verifyMagicLink(raw)).rejects.toMatchObject({ code: "MAGIC_LINK_INVALID" });
  });
});

describe("password login", () => {
  it("logs in an admin and rejects bad credentials", async () => {
    await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
      ["admin@b.com", "Admin", hashPassword("supersecret")]);
    expect((await loginWithPassword("admin@b.com", "supersecret")).principalType).toBe("admin");
    await expect(loginWithPassword("admin@b.com", "nope")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("logs in a customer after they set a password", async () => {
    const c = await withTransaction((cx) => ensureCustomer(cx, "c@b.com"));
    await setCustomerPassword(c.id, "customerpass");
    expect((await loginWithPassword("c@b.com", "customerpass")).principalType).toBe("customer");
  });
});
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/auth.test.js`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add server/mailer.js server/auth.js server/__tests__/auth.test.js server/__tests__/helpers.js
git commit -m "feat(server): auth domain — magic link, password, guest customer provisioning"
```

---

### Task 6: Express app + middleware + static SPA

**Files:**
- Create: `server/middleware.js`
- Create: `server/app.js`
- Modify: `server/index.js`
- Test: `server/__tests__/app.test.js`

**Interfaces:**
- Produces: `createApp() -> express.Application` from `./app.js`.
- Produces from `./middleware.js`: `attachPrincipal` (resolves cookie→session→`req.principal`), `requireCustomer`, `requireAdmin`, `COOKIE_CUSTOMER='bd_sid'`, `COOKIE_ADMIN='bd_admin'`, `setSessionCookie(res, name, session)`, `clearSessionCookie(res, name)`.

- [ ] **Step 1: Create `server/middleware.js`**

```js
import { getSession } from "./session.js";
import { ApiError } from "./errors.js";

export const COOKIE_CUSTOMER = "bd_sid";
export const COOKIE_ADMIN = "bd_admin";

export function setSessionCookie(res, name, session) {
  res.cookie(name, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res, name) {
  res.clearCookie(name, { path: "/" });
}

// Resolves both cookies (if present) into req.principal = { type, id } | null
export async function attachPrincipal(req, _res, next) {
  try {
    const adminSid = req.cookies?.[COOKIE_ADMIN];
    const custSid = req.cookies?.[COOKIE_CUSTOMER];
    const admin = adminSid ? await getSession(adminSid) : null;
    const customer = !admin && custSid ? await getSession(custSid) : null;
    const row = admin || customer;
    req.principal = row ? { type: row.principal_type, id: Number(row.principal_id) } : null;
    next();
  } catch (e) { next(e); }
}

export function requireCustomer(req, _res, next) {
  if (req.principal?.type === "customer") return next();
  next(new ApiError("CUSTOMER_AUTH_REQUIRED", 401));
}

export function requireAdmin(req, _res, next) {
  if (req.principal?.type === "admin") return next();
  next(new ApiError("ADMIN_AUTH_REQUIRED", 401));
}
```

- [ ] **Step 2: Create `server/app.js`**

```js
import express from "express";
import cookieParser from "cookie-parser";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { ApiError } from "./errors.js";
import { attachPrincipal } from "./middleware.js";
import { query } from "./db.js";
import { authRouter } from "./authRoutes.js";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(attachPrincipal);

  app.get("/v1/health", async (_req, res, next) => {
    try {
      const db = await query("select now() as now");
      res.json({ ok: true, databaseTime: db.rows[0].now });
    } catch (e) { next(e); }
  });

  app.use("/v1/auth", authRouter());

  // Any unmatched /v1 route returns the JSON error contract (never the SPA).
  app.use("/v1", (_req, _res, next) => next(new ApiError("NOT_FOUND", 404)));

  // Serve built SPA (prod). In dev, Vite serves the SPA and proxies /v1 here.
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/v1\/).*/, (_req, res) => res.sendFile(join(distDir, "index.html")));
  }

  // JSON error contract
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  });

  return app;
}
```

- [ ] **Step 3: Replace `server/index.js`**

```js
import { createApp } from "./app.js";
import { closePool } from "./db.js";

const port = Number(process.env.API_PORT || 8787);
const app = createApp();
const server = app.listen(port, () => {
  console.log(`BeloveDiamond API on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => closePool().finally(() => process.exit(0)));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

- [ ] **Step 4: Write the failing test `server/__tests__/app.test.js`**

```js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

describe("app skeleton", () => {
  it("health returns ok with a database time", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.databaseTime).toBeTruthy();
  });
  it("unknown /v1 route returns the JSON error contract", async () => {
    const res = await request(app).get("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
```

> Note: `authRoutes.js` does not exist yet, so Step 5 will fail to import. That is expected — Task 7 creates it. To keep Task 6 independently runnable, temporarily comment the `authRouter` import and its `app.use("/v1/auth", ...)` line, verify health passes, then uncomment in Task 7. (If executing tasks in order with a subagent, create a minimal stub instead — see Task 7 Step 1.)

- [ ] **Step 5: Create a minimal `server/authRoutes.js` stub so the app imports**

```js
import { Router } from "express";
export function authRouter() {
  return Router(); // filled in Task 7
}
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/app.test.js`
Expected: 2 passing.

- [ ] **Step 7: Commit**

```bash
git add server/middleware.js server/app.js server/index.js server/authRoutes.js server/__tests__/app.test.js
git commit -m "feat(server): Express app — middleware, session guards, health, static SPA, error contract"
```

---

### Task 7: Auth routes + admin seed

**Files:**
- Modify: `server/authRoutes.js` (replace the stub)
- Create: `server/seedAdmin.js`
- Modify: `package.json` (add `seed:admin` script)
- Test: `server/__tests__/authRoutes.test.js`

**Interfaces:**
- Consumes: `createMagicLink`, `verifyMagicLink`, `loginWithPassword`, `setCustomerPassword` (auth.js); `setSessionCookie`, `clearSessionCookie`, `requireCustomer`, `COOKIE_CUSTOMER`, `COOKIE_ADMIN` (middleware.js); `revokeSession` (session.js).
- Routes produced:
  - `POST /v1/auth/magic-link` `{email}` → `{ ok, devLink? }`
  - `GET /v1/auth/callback?token=` → sets `bd_sid`, returns `{ ok, principal:"customer" }`
  - `POST /v1/auth/password` `{email,password}` → sets `bd_sid` or `bd_admin`, returns `{ ok, principal }`
  - `POST /v1/auth/set-password` `{password}` (requireCustomer) → `{ ok }`
  - `POST /v1/auth/logout` → clears cookies, revokes session → `{ ok }`
  - `GET /v1/auth/me` → `{ principal: {type,id}|null }`

- [ ] **Step 1: Replace `server/authRoutes.js`**

```js
import { Router } from "express";
import { ApiError } from "./errors.js";
import { createMagicLink, verifyMagicLink, loginWithPassword, setCustomerPassword } from "./auth.js";
import { revokeSession } from "./session.js";
import {
  setSessionCookie, clearSessionCookie, requireCustomer,
  COOKIE_CUSTOMER, COOKIE_ADMIN,
} from "./middleware.js";

function originOf(req) {
  return process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
}

export function authRouter() {
  const r = Router();

  r.post("/magic-link", async (req, res, next) => {
    try {
      const { email, orderCode } = req.body || {};
      const { link } = await createMagicLink(email, { origin: originOf(req), orderCode: orderCode || null });
      const body = { ok: true };
      if (process.env.NODE_ENV !== "production") body.devLink = link; // dev surfaces the link
      res.status(201).json(body);
    } catch (e) { next(e); }
  });

  r.get("/callback", async (req, res, next) => {
    try {
      const token = req.query.token;
      if (!token) throw new ApiError("MAGIC_LINK_INVALID", 400);
      const { session } = await verifyMagicLink(String(token));
      setSessionCookie(res, COOKIE_CUSTOMER, session);
      res.json({ ok: true, principal: "customer" });
    } catch (e) { next(e); }
  });

  r.post("/password", async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      const { principalType, session } = await loginWithPassword(email, password);
      setSessionCookie(res, principalType === "admin" ? COOKIE_ADMIN : COOKIE_CUSTOMER, session);
      res.json({ ok: true, principal: principalType });
    } catch (e) { next(e); }
  });

  r.post("/set-password", requireCustomer, async (req, res, next) => {
    try {
      await setCustomerPassword(req.principal.id, req.body?.password);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/logout", async (req, res, next) => {
    try {
      await revokeSession(req.cookies?.[COOKIE_CUSTOMER]);
      await revokeSession(req.cookies?.[COOKIE_ADMIN]);
      clearSessionCookie(res, COOKIE_CUSTOMER);
      clearSessionCookie(res, COOKIE_ADMIN);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/me", (req, res) => {
    res.json({ principal: req.principal || null });
  });

  return r;
}
```

- [ ] **Step 2: Create `server/seedAdmin.js`**

```js
import { query, closePool } from "./db.js";
import { hashPassword } from "./passwords.js";

const email = (process.env.SEED_ADMIN_EMAIL || "admin@belovediamond.test").toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";

async function run() {
  await query(
    `insert into admin_users (email, name, password_hash) values ($1,$2,$3)
     on conflict (email) do update set password_hash=excluded.password_hash, active=true`,
    [email, "BeloveDiamond Admin", hashPassword(password)],
  );
  console.log(`seeded admin ${email} (password: ${password})`);
}
run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closePool());
```

Add to `package.json` scripts:
```json
"seed:admin": "node server/seedAdmin.js"
```

- [ ] **Step 3: Write the failing test `server/__tests__/authRoutes.test.js`**

```js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { truncateAuth } from "./helpers.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); });

describe("auth routes", () => {
  it("magic-link → callback issues a customer session cookie", async () => {
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "g@b.com" });
    expect(ml.status).toBe(201);
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`);
    expect(cb.body.principal).toBe("customer");
    expect(cb.headers["set-cookie"].join()).toMatch(/bd_sid=/);
  });

  it("admin password login sets bd_admin and is rejected on customer routes", async () => {
    await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
      ["admin@b.com", "A", hashPassword("admin12345")]);
    const login = await request(app).post("/v1/auth/password").send({ email: "admin@b.com", password: "admin12345" });
    expect(login.body.principal).toBe("admin");
    const cookie = login.headers["set-cookie"];
    // admin cookie must NOT satisfy requireCustomer
    const setpw = await request(app).post("/v1/auth/set-password").set("Cookie", cookie).send({ password: "longenough" });
    expect(setpw.status).toBe(401);
    expect(setpw.body.error.code).toBe("CUSTOMER_AUTH_REQUIRED");
  });

  it("logout revokes the session so /me is anonymous", async () => {
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "g2@b.com" });
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`);
    const cookie = cb.headers["set-cookie"];
    expect((await request(app).get("/v1/auth/me").set("Cookie", cookie)).body.principal.type).toBe("customer");
    await request(app).post("/v1/auth/logout").set("Cookie", cookie);
    expect((await request(app).get("/v1/auth/me").set("Cookie", cookie)).body.principal).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm run test:server -- server/__tests__/authRoutes.test.js`
Expected: 3 passing.

- [ ] **Step 5: Run the whole backend suite**

Run: `npm run test:server`
Expected: all backend test files pass.

- [ ] **Step 6: Commit**

```bash
git add server/authRoutes.js server/seedAdmin.js package.json server/__tests__/authRoutes.test.js
git commit -m "feat(server): auth routes (magic link, password, logout, me) + admin seed"
```

---

### Task 8: Remove vendor / dealer / supplier from the frontend

**Files:**
- Delete: `src/pages/dealer/` (whole dir), `src/pages/supplier/` (whole dir)
- Delete: `src/pages/VendorLogin.jsx`, `src/pages/DealerApply.jsx`, `src/pages/Diamonds.jsx`, `src/pages/DiamondDetail.jsx`
- Delete: `src/dealerStrings.js`, `src/lib/dealer.js`, `src/lib/__tests__/dealer.test.js`, `src/lib/__tests__/dealerStore.test.js`
- Modify: `src/App.jsx`, `src/Layout.jsx` (remove links/routes if any), `src/lib/store.js` (remove dealer/vendor/pool/wholesale/warranty/claim exports), `src/lib/auth.jsx` (remove `loginWithCode`, supplier handling — done fully in Task 9)

**Interfaces:**
- Produces: a frontend that builds and whose remaining tests pass, with zero references to dealer/vendor/supplier.

- [ ] **Step 1: Delete the files**

```bash
git rm -r src/pages/dealer src/pages/supplier
git rm src/pages/VendorLogin.jsx src/pages/DealerApply.jsx src/pages/Diamonds.jsx src/pages/DiamondDetail.jsx
git rm src/dealerStrings.js src/lib/dealer.js
git rm src/lib/__tests__/dealer.test.js src/lib/__tests__/dealerStore.test.js
```

- [ ] **Step 2: Find every remaining reference**

Run:
```bash
grep -rnE "dealer|vendor|supplier|VendorLogin|DealerApply|Diamonds|DiamondDetail|poolDiamond|wholesale|warranty|claim" src/ --include=*.jsx --include=*.js | grep -v "__tests__"
```
Expected: a list of imports/routes/usages to remove. Address each in the next steps.

- [ ] **Step 3: Remove dead routes/imports in `src/App.jsx`**

Delete any `import`/`<Route>` lines referencing the deleted pages. Confirm `src/App.jsx` no longer imports `Diamonds`, `DiamondDetail`, `VendorLogin`, `DealerApply`, or anything from `pages/dealer`/`pages/supplier`. (Routes for these were already not mounted in the customer router, but remove leftover imports/aliases.)

- [ ] **Step 4: Remove dealer/vendor exports from `src/lib/store.js`**

Delete the exported functions and their helpers for: `listVendors`, `setVendorActive`, `listPoolDiamonds`, `getPoolDiamond`, `savePoolDiamond`, `archivePoolDiamond`, `setPoolAvailability`, `matchPoolForOrder`, `submitPoolCandidates`, `supplierTasks`, `listApplications`, `submitApplication`, `approveApplication`, `rejectApplication`, `getDealerProfile`, `listDealers`, `updateDealerProfile`, `dealerTierInfo`, `listCatalog`, `getCatalogItem`, `saveCatalogItem`, `listWholesaleOrders`, `createWholesaleOrder`, `transitionWholesale`, `listWarrantyRegs`, `registerWarranty`, `listClaims`, `getClaim`, `submitClaim`, `adjudicateClaim`, `receiveClaimReturn`, `markClaimReplaced`, `listSalvage`. Remove now-unused imports from `./dealer.js` at the top of the file.

- [ ] **Step 5: Run the frontend test suite and build**

Run: `npm test`
Expected: PASS (remaining tests). If a test imports a removed module, delete that test file.
Run: `npm run build`
Expected: build succeeds with no unresolved imports.

- [ ] **Step 6: Re-grep to confirm removal**

Run:
```bash
grep -rnE "pages/dealer|pages/supplier|VendorLogin|DealerApply|dealerStrings|lib/dealer" src/
```
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(web): remove vendor/dealer/supplier surface (out of scope)"
```

---

### Task 9: Frontend API client, auth rewire, Vite proxy

**Files:**
- Create: `src/lib/api/client.js`
- Modify: `src/lib/auth.jsx`
- Modify: `vite.config.js`
- Test: `src/lib/api/__tests__/client.test.js`

**Interfaces:**
- Produces from `src/lib/api/client.js`:
  - `apiGet(path) -> Promise<json>`
  - `apiSend(method, path, body, { idempotencyKey? }) -> Promise<json>`
  - `ApiClientError` with `.code` (mapped from `{error:{code}}`)
- Produces from `src/lib/auth.jsx` (preserved names so pages keep working): `AuthProvider`, `useAuth()` → `{ user, requestMagicLink(email), loginWithPassword(email,password), logout(), refresh() }`, `RequireRole`.

- [ ] **Step 1: Create `src/lib/api/client.js`**

```js
const BASE = "/v1";

export class ApiClientError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

async function parse(res) {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const code = json?.error?.code || "INTERNAL_ERROR";
    throw new ApiClientError(code, res.status, json?.error?.message);
  }
  return json;
}

export async function apiGet(path) {
  return parse(await fetch(`${BASE}${path}`, { credentials: "include" }));
}

export async function apiSend(method, path, body, { idempotencyKey } = {}) {
  const headers = { "content-type": "application/json" };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return parse(await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}
```

- [ ] **Step 2: Write the failing test `src/lib/api/__tests__/client.test.js`**

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { apiGet, apiSend, ApiClientError } from "../client.js";

afterEach(() => { vi.restoreAllMocks(); });

function mockFetch(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status < 400, status, text: async () => JSON.stringify(body),
  });
}

describe("api client", () => {
  it("returns parsed json on success", async () => {
    mockFetch(200, { ok: true });
    expect(await apiGet("/auth/me")).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith("/v1/auth/me", { credentials: "include" });
  });
  it("throws ApiClientError carrying the domain code", async () => {
    mockFetch(401, { error: { code: "CUSTOMER_AUTH_REQUIRED" } });
    await expect(apiGet("/customer/orders")).rejects.toMatchObject({ code: "CUSTOMER_AUTH_REQUIRED", status: 401 });
  });
  it("attaches an idempotency-key header when given", async () => {
    mockFetch(201, { ok: true });
    await apiSend("POST", "/customer/intakes", { a: 1 }, { idempotencyKey: "k1" });
    const init = global.fetch.mock.calls[0][1];
    expect(init.headers["idempotency-key"]).toBe("k1");
    expect(init.method).toBe("POST");
  });
});
```

- [ ] **Step 3: Run the test — expect FAIL then PASS**

Run: `npm test -- src/lib/api/__tests__/client.test.js`
Expected: after Step 1 exists, 3 passing. (If run before Step 1, FAIL with module-not-found.)

- [ ] **Step 4: Rewrite `src/lib/auth.jsx`**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiGet, apiSend } from "./api/client.js";

const AuthContext = createContext(null);
export const LOGIN_FOR = { customer: "/sign-in", admin: "/staff" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);     // { type, id } | null
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { principal } = await apiGet("/auth/me");
      setUser(principal);
    } catch { setUser(null); } finally { setReady(true); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const requestMagicLink = useCallback(async (email) => {
    const res = await apiSend("POST", "/auth/magic-link", { email });
    return res.devLink || null; // dev surfaces the link for the UI
  }, []);

  const loginWithPassword = useCallback(async (email, password) => {
    const res = await apiSend("POST", "/auth/password", { email, password });
    await refresh();
    return res.principal;
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiSend("POST", "/auth/logout", {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, refresh, requestMagicLink, loginWithPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireRole({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to={LOGIN_FOR[role] || "/sign-in"} state={{ from: location.pathname }} replace />;
  if (role && user.type !== role) return <Navigate to="/" replace />;
  return children;
}
```

> Note: `Login.jsx` and `StaffLogin.jsx` consume the old `login/signup/loginWithCode` API. They must be updated to call `requestMagicLink` / `loginWithPassword`. This wiring is part of P1 (auth UI screens). For P0, if those pages fail to compile, replace their bodies with a minimal form calling the new methods, or stub the removed calls — the production auth UI is a P1 deliverable. Keep the build green.

- [ ] **Step 5: Update `vite.config.js` dev proxy**

Ensure the config includes:
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/v1": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
  test: { environment: "jsdom", globals: true },
});
```
(Merge `server.proxy` into the existing config rather than overwriting unrelated fields.)

- [ ] **Step 6: Build and test**

Run: `npm test`
Expected: PASS (including the new client test).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual smoke (optional but recommended)**

In two terminals:
```bash
npm run db:migrate && npm run seed:admin && npm run api   # terminal 1
npm run dev                                               # terminal 2
```
Visit the dev site, request a magic link on the sign-in page, and confirm the dev link is returned and following it logs you in (`/v1/auth/me` shows a customer principal).

- [ ] **Step 8: Commit**

```bash
git add src/lib/api/client.js src/lib/api/__tests__/client.test.js src/lib/auth.jsx vite.config.js
git commit -m "feat(web): API client + session/magic-link auth context + dev proxy"
```

---

## Self-Review

**Spec coverage (P0 portion of the design):**
- Single-origin Express + pg + static SPA → Tasks 6, 9. ✓
- Migration runner fix (auto-discover, runs 0002) → Task 1. ✓
- 0003 auth migration (sessions, magic_link_tokens, admin_users, customers.password_hash) → Task 2. ✓
- Guest customer provisioning + magic link (dev-surfaced) + optional password + admin login + DB sessions + logout/revocation → Tasks 5, 7, 9. ✓
- Audience isolation (admin cookie not valid on customer routes) → Task 7 test asserts it. ✓
- Frontend API client (credentials, idempotency header, error-code mapping) → Task 9. ✓
- Remove vendor/dealer/supplier (HLD invariant #14) → Task 8. ✓
- Identity from session, never header → middleware.js (Task 6); no header identity anywhere. ✓
- `published_artifacts` drop + workflow tables (0004) → **deferred to P2 plan** (not needed for P0/P1). Noted.

**Placeholder scan:** No "TBD/TODO" in code steps. The two forward-looking notes (Task 6 authRoutes stub; Task 9 Login/StaffLogin UI) are explicit, bounded handoffs with a concrete interim action, not vague placeholders.

**Type/name consistency:** `nextCode(client, prefix)`, `issueSession→{id,expiresAt}`, `getSession→row|null`, `hashToken`, `verifyMagicLink→{session,customer}`, `loginWithPassword→{principalType,session}`, cookie names `bd_sid`/`bd_admin`, middleware `req.principal={type,id}`, client `apiGet/apiSend/ApiClientError` — all referenced consistently across tasks. ✓

**Deferred to later plans (intentionally out of P0 scope):** public styles endpoint, intake create/submit, account/order projection, the workflow engine, diamonds/quotes/CAD/QC/shipments, media upload sessions, payments seam. These are P1–P4.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-customer-admin-backend-p0-foundation.md`.
