# Live Chat — Design Spec

- **Date:** 2026-07-07
- **Status:** Approved (brainstorm) → implementation
- **Branch:** `feat/live-chat`

## Summary

Add a Rare-Carat-style live chat to belovediamond.com: a site-wide floating widget where
**anonymous visitors** and **logged-in customers** can message staff, answered from a new
**inbox in the admin console** (`/bo-4q9z7m/chat`). Custom-built on the existing stack — no
SaaS, no realtime provider.

### Decisions (from brainstorm)

| Topic | Decision |
|-------|----------|
| Build vs buy | **Custom** on Express / Neon Postgres / React |
| Audience | **Both** — anonymous site-wide + auto-link to customer/order on OTP login |
| Transport | **Short polling** (~3s) while a pane is open — no WebSocket/SSE |
| Notifications | **Console unread badge + email fallback** (staff on new inbound, throttled; customer on staff reply when offline, locale-aware via Resend) |
| MVP includes | Image attachments (R2 reuse), staff avatar/name persona, order/activity context panel |
| Baked in | Anonymity masking, spam rate-limiting, admin console inbox |
| Out of scope (v1) | Offline/business-hours UI, web push, bots/auto-reply, canned replies |

## Architecture

```
[visitor/customer]  <ChatWidget/> ──poll 3s──►  Express /v1/chat     ─┐
  Layout-mounted, hidden on /bo-*,/gate-*,/admin  (bd_chat httpOnly)  │
                                                                      ├─ Neon: chat_threads, chat_messages
[staff]  AdminChat inbox ──poll 3-5s──►  /v1/admin/chat (requireAdmin)┘
                                                                      │
   new inbound ─► staff email (throttled per thread)                 │
   staff reply + customer offline ─► customer email (locale, Resend) ┘
```

- **Serverless-safe:** polling only; nothing holds a connection.
- **Reuse:** R2 presigned upload (`chat` scope), `mailer`/`orderMail` pattern, `rateLimit`,
  `nextCode`, `maskContacts`, admin `con-*` design system.

## Data model — `db/migrations/0009_chat.sql`

```sql
create sequence if not exists chat_code_seq start 100001;   -- CHAT-xxxxxx

create table chat_threads (
  id bigint generated always as identity primary key,
  thread_code text not null unique,               -- CHAT-100001
  token_hash text unique,                          -- sha256 of the anon bd_chat token (null once only customer-owned)
  customer_id bigint references customers(id) on delete set null,
  activity_session_id text,                        -- bd_aid, for the staff context panel
  status text not null default 'open' check (status in ('open','closed')),
  visitor_email text,                              -- captured/known email for offline reply
  visitor_locale text not null default 'en',
  last_message_at timestamptz not null default now(),
  staff_unread int not null default 0,             -- inbound since staff last read
  customer_unread int not null default 0,          -- staff msgs since visitor last read
  customer_last_seen_at timestamptz,               -- for offline-email decision
  staff_notified_at timestamptz,                   -- throttle staff notification email
  created_at timestamptz not null default now()
);
create index chat_threads_inbox_idx on chat_threads (status, last_message_at desc);
create index chat_threads_customer_idx on chat_threads (customer_id) where customer_id is not null;

create table chat_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references chat_threads(id) on delete cascade,
  sender text not null check (sender in ('visitor','staff','system')),
  sender_admin_id bigint references admin_users(id) on delete set null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,  -- [{url,contentType,name}]
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on chat_messages (thread_id, id);
```

Register `chat_code_seq`→`CHAT` prefix in `server/codes.js`.

## Identity & security

- **Anonymous thread token:** on first visitor message the server mints a 256-bit random token,
  stores only `sha256(token)` as `token_hash`, and sets it as an **httpOnly, `sameSite=lax`,
  `secure` (prod)** cookie `bd_chat`. All anonymous reads/writes resolve the thread by
  `token_hash` — a visitor can only touch their own thread. (Directly fixes the audit's
  session-token-at-rest and IDOR concerns; token never stored in plaintext.)
- **Customer link:** in `authRoutes.linkActivity` (OTP/magic/password success) call
  `linkChatToCustomer(bd_chat, customerId)` — sets `customer_id`, backfills `visitor_email`.
  After linking, the customer session (`bd_sid`) also grants access to their thread(s).
- **Access resolution** (`resolveChatThread(req)`): admin → any thread by code; customer →
  thread where `customer_id = principal.id`; else → thread by `bd_chat` token_hash. No match → 401/404.
- **Rate limiting:** `rateLimit` on send (per bd_chat+ip), thread-create, and upload-url. Body
  capped (4000 chars), attachments ≤ 4, types via existing `ALLOWED_TYPES`.
- **Masking:** visitor free text passes through `maskContacts` on store (same as reviews).
  Staff see the thread; the context panel only surfaces already-authorized data.

## API surface

**Customer (`/v1/chat`, same-origin, `bd_chat` cookie):**
- `POST /v1/chat/messages` `{ body?, attachments?, locale? }` → creates thread + sets `bd_chat` if
  none; appends visitor message; bumps `staff_unread`; returns `{ thread, message }`.
- `GET  /v1/chat/thread?since=<id>` → `{ thread, messages, staffAgent }`; marks `customer_unread=0`,
  sets `customer_last_seen_at`. `since` returns only newer messages (poll cursor).
- `POST /v1/chat/upload-url` `{ contentType, size }` → presigned R2 (`chat` scope), owner-gated.
- `POST /v1/chat/close` (optional) → visitor closes thread.

**Admin (`/v1/admin/chat`, `requireAdmin`):**
- `GET  /threads?status=open` → inbox list (code, preview, unread, customer/order hint, last_at).
- `GET  /threads/:code?since=<id>` → messages + **context** (linked customer, their orders, recent
  activity) ; marks `staff_unread=0`.
- `POST /threads/:code/messages` `{ body?, attachments? }` → staff reply; bumps `customer_unread`;
  triggers offline customer email if `customer_last_seen_at` stale (> 60s) and email known.
- `POST /threads/:code/close` / `/reopen`.

## Notifications (`server/chatMail.js`)

- **Staff (new inbound):** if `now - staff_notified_at > 5min`, email staff address
  (`CHAT_NOTIFY_EMAIL || MAIL_FROM`) with a preview + inbox link; set `staff_notified_at`.
- **Customer (offline):** on staff reply, if `visitor_email` known and `customer_last_seen_at`
  older than 60s, email the customer (locale copy) linking back to the site. Reuses `sendOrderMail`
  wrapper. Fire-and-forget (never blocks the reply).

## Client

- `src/lib/chat.js` — API calls + a small polling controller (start/stop, cursor, backoff on error).
- `src/components/ChatWidget.jsx` — floating bubble + panel (messages list, composer, attach,
  staff avatar/name header, unread dot). Themed to NOIR/Ivory. Persists open/closed in state only.
- Mounted once in `src/Layout.jsx`; hidden on `/bo-*`, `/gate-*`, `/admin*` and when the API is
  unavailable (static demo build, `!WITH_BACKOFFICE`). Polls only while open + on visibility.

## Admin console

- `src/pages/admin/AdminChat.jsx` — three-pane inbox using `con-*` classes / `ConsoleHead` /
  `StatStrip`: thread list (left), conversation + composer (center), context panel (right:
  linked customer/orders/recent activity). Route `/bo-4q9z7m/chat` in `console.jsx`; nav entry +
  unread badge.
- Staff persona: `STAFF_AGENT = { name, avatar }` constant surfaced to the widget header
  (single shared persona for v1).

## Testing (vitest + supertest, local `belovediamond_test`)

- **Repository:** thread create/find by token_hash; scoping (visitor A cannot read B); customer
  link; unread counters; `since` cursor; masking on store.
- **Customer routes:** unauthenticated create sets cookie; rate limits; validation; upload-url
  owner-gate; poll marks read.
- **Admin routes:** `requireAdmin` on every endpoint; reply bumps customer_unread; context payload.
- **Notifications:** staff throttle window; offline-customer decision. Assert via a mail spy
  (`drainMail`) — no real send in test.
- Add `truncateChat()` helper.

## Out of scope (v1)

Offline/business-hours gating UI, web push, chatbots/auto-reply, canned replies, multi-agent
routing/assignment, typing indicators, read receipts beyond unread counts.
