# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack e-commerce application with a **Next.js frontend** (App Router, TypeScript) and a **Flask backend** (PostgreSQL via Neon). Currency is PKR throughout.

---

## Commands

### Frontend (`frontend/`)

```bash
npm install        # install dependencies (first time)
npm run dev        # development server on :3000
npm run build      # production build
npm start          # serve production build
```

There is no lint script or test suite configured.

### Backend (`backend/`)

```bash
uv sync                       # install dependencies (first time, requires uv)
uv run python app.py          # development server (port set in app.py __main__ block — check it; 5000/5001)
uv run python migrate.py      # run pending DB migrations manually

# Chatbot (Phase 0) — run the MCP sidecar alongside the Flask app
uv run python mcp_server/server.py   # FastMCP tool server on :8900 (separate terminal)
uv run python ingest_kb.py kb        # (re)ingest KB files under backend/kb into kb_documents
```

No test suite is configured for either project.

The chatbot needs **two** backend processes: `app.py` (Flask, :5001) and
`mcp_server/server.py` (FastMCP sidecar, :8900). Restart the sidecar after
changing `GOOGLE_API_KEY`, since the embedder reads it at construction.

---

## Architecture

### Frontend

- **Framework**: Next.js App Router (`frontend/app/`). All pages are React Server Components by default; client interactivity uses `"use client"`.
- **Routing**: File-system based. Public routes live at the top level (`cart`, `login`, `register`, `order`, `order-history`, `product`); `admin/` routes (dashboard, products, orders, coupons, users) are protected by a client-side role check that redirects non-admins.
- **State**: Zustand stores in `frontend/store/` — `cartStore.ts` (persisted to localStorage) and `couponStore.ts`.
- **API calls**: Axios, pointed at `NEXT_PUBLIC_API_BASE_URL`. There is no shared API client — each page reads the env var and builds its own axios calls, so the base URL must be set (or defaulted per-page) consistently. All authenticated requests attach `Authorization: Bearer <token>` from localStorage.
- **Auth**: JWT decoded client-side with `jwt-decode`. Token stored in localStorage with a 2-hour TTL set by the backend.
- **UI**: Tailwind CSS v4 + Radix UI primitives + Shadcn/ui components (in `frontend/components/ui/`). Framer Motion for animations.
- **Validation**: React Hook Form + Zod on all forms.

### Backend

- **Framework**: Flask with Blueprint-per-resource routing (`backend/routes/`). All blueprints registered in `app.py`.
- **Database**: PostgreSQL (Neon hosted). Direct `psycopg2` connections — no ORM, raw SQL everywhere. `database.py:get_connection()` returns a connection with `RealDictCursor` (rows are dicts). Routes open/close their own connections per request.
- **Schema management is two-layered**:
  1. `database.py:init_db()` holds the baseline `CREATE TABLE IF NOT EXISTS` statements for every table.
  2. `migrations/*.sql` add incremental changes (e.g. `users.role`, `products.stock`). `migrate.py` applies them in **alphabetical filename order** and records applied files in a `schema_migrations` table.

  Both run automatically on every backend startup (`app.py` calls `run_migrations()` then `init_db()`), so a new migration file takes effect on next boot. New columns on existing tables must go in a migration — editing `init_db()` alone won't alter already-created tables.
- **Auth middleware** (`auth_middleware.py`): `@token_required` validates the JWT, loads the user row from the DB, and passes the user dict as the **first positional argument** to the route function — every protected route is `def handler(user, ...)`. `@admin_required` stacks *under* `@token_required` and checks `user["role"] == "admin"`. Decorator order matters:
  ```python
  @token_required
  @admin_required
  def admin_route(user): ...
  ```
- **CORS**: Configured in `app.py` to allow the localhost dev origin and two production origins (Vercel + GitHub Codespaces). New frontend origins must be added there.

### Checkout / payment flow (spans multiple files)

`utils/place_order.py` contains the shared order logic used by both the orders and payments blueprints:

- `create_order_for_user(...)` — reads the user's cart, computes the total, applies an optional coupon (capped at the order total), inserts `orders` + `order_items`, and clears the cart. It deliberately does **not** decrement coupon `uses_left` or product stock.
- `validate_coupon(...)` — checks existence, active status, remaining uses, and one-redemption-per-user (`coupon_redemptions` unique constraint).

Side effects happen only after successful payment, in `routes/payments.py` (`make_payment`): stock is decremented with a guard (`WHERE stock >= quantity`, raises on insufficient stock), the coupon redemption row is inserted, and `uses_left` is decremented. Payments are internal wallet-style: `payment_methods` rows carry a `balance` that users top up — there is no external payment gateway.

### API Surface

| Blueprint | Prefix | Key responsibilities |
|-----------|--------|---------------------|
| users | `/users` | register, login, list users (admin) |
| products | `/products` | product CRUD (admin write) |
| carts | `/carts` | per-user cart read/write |
| orders | `/orders` | checkout, order history, status management |
| payments | `/payments` | payment methods, top-up, process payment |
| coupons | `/coupons` | validate code, active list, CRUD (admin) |
| reviews | `/reviews` | post & fetch product reviews |
| support | `/support` | user↔admin support messaging |
| stats | `/stats` | admin dashboard aggregates |
| chat | `/chat` | LangGraph support bot — `POST /chat/stream` (SSE) |

### Chatbot (Phase 0)

A LangGraph customer-support bot lives in `routes/chat.py`, registered as `chat_bp` at `/chat`. See `SCOPE.md` / `architecture.md` for the full multi-phase design; Phase 0 is a single FAQ/greeting agent.

- **`POST /chat/stream`** (`@token_required`) — Server-Sent Events. Emits `event: session` (the `chats.id` to thread on), streamed `data: {"token": ...}` frames, then `event: done`. Creates/reuses a `chats` row and appends user + assistant rows to `chat_messages` every turn.
- **Model**: OpenAI — `gpt-4o-mini` (chat + router) + `text-embedding-3-small` at **1536 dims** (RAG). Env key `OPENAI_API_KEY`; chat model overridable via `CHAT_MODEL`. (The project was originally Gemini-only; it was switched to OpenAI — migration `0004_kb_openai_1536.sql` widened `kb_documents.embedding` to `vector(1536)` and the KB was re-ingested. Some `architecture.md` / `SCOPE.md` text still says Gemini.)
- **MCP sidecar** (`mcp_server/server.py`, FastMCP on :8900, streamable-HTTP): `server.py` creates the shared `FastMCP` and registers per-resource tool modules under `mcp_server/tools/` (`orders.py`, `products.py`, `coupons.py`, `payments.py`, `rag.py`), each exposing a `register(mcp)`. Every user-scoped tool calls the Flask REST layer over HTTP carrying the caller's JWT (via `mcp_server/tools/_ctx.py:jwt_from_ctx`), so `@token_required` stays the single auth choke point; MCP never touches the DB for user data. The one exception is `search_knowledge_base` (shared-KB pgvector cosine search — the one allowed direct-DB tool, in `rag.py`). The chat blueprint is the MCP client via `langchain-mcp-adapters`, forwarding the end-user JWT as an `Authorization` header on the MCP connection.
- **RAG store**: `kb_documents` (pgvector `vector(768)`, ivfflat cosine index). Ingest with `ingest_kb.py` (idempotent, dedupes by `(source, chunk_hash)`); source docs under `backend/kb/`.
- **New tables** (migrations `0001`–`0003`): `vector` extension, `chats`, `chat_messages`, `kb_documents`.
- **Async bridge**: LangGraph/MCP are async, Flask is sync WSGI. The SSE generator pumps the async token stream through a dedicated event loop. Run under gunicorn+gevent/threads in prod.
- **Frontend**: `frontend/components/ChatWidget.tsx` (extracted from `page.tsx`) has an **Assistant** tab (bot, `POST /chat/stream` via `fetch` + `ReadableStream` — not `EventSource`, which is GET-only) and a **Human support** tab (the existing `/support/*` path, kept intact for Phase 2 escalation). Session id persisted in `localStorage` as `chat_session_id`.

### Chatbot (Phase 1) — router + read-only agents

Phase 1 replaces Phase 0's single ReAct agent with a real router-dispatched multi-agent `StateGraph` in `routes/chat.py`, all **read-only**. The frontend is unchanged — the widget streams tokens agent-agnostically.

- **Graph**: `START → recall → router → {order|product|promotion|account|payment|faq} → END`. `ChatState` carries `messages`, `user_id`, `jwt`, `active_agent`, `router_confidence`.
- **Router** (`router_node`): a `gpt-4o-mini` `with_structured_output(Route)` call returns `{intent, confidence}`. Below `CONFIDENCE_THRESHOLD` (0.5) or an unknown intent falls back to the **FAQ/General** agent — the Support & Escalation agent is Phase 2, so low confidence degrades gracefully rather than escalating.
- **Workers**: five `create_react_agent` nodes with scoped MCP allow-lists plus Phase 0's FAQ/General fallback — Order (`get_orders`, `get_order`), Product (`search_products`, `get_product`, `search_knowledge_base`), Promotion (`list_active_coupons`), Account (`get_orders`), Payment (`get_payments`, `get_payment_status`, `get_order_payments`), FAQ (`search_knowledge_base`, `get_orders`).
- **6 new read tools** over existing REST endpoints: `get_order`, `search_products`, `get_product`, `list_active_coupons`, `get_payments`, `get_payment_status` (+ `get_order_payments`). **2 new read-only endpoints** (the only backend additions): `GET /payments/<id>/status` and `GET /orders/<id>/payments`, both `@token_required` and ownership-guarded (foreign ids 404). No migrations.
- **Streaming (load-bearing)**: the SSE contract and async→sync bridge are unchanged from Phase 0. Only worker tokens are streamed. Two version-specific gotchas, both verified against the installed langgraph 1.2 / langchain-google-genai 4.2:
  - *Subgraph streaming*: each worker is a `create_react_agent` subgraph, and its LLM tokens only surface through the parent stream when **`astream(..., stream_mode="messages", subgraphs=True)`** — which also changes the event shape to `(namespace_tuple, (chunk, meta))`. Without `subgraphs=True` the parent only streams the router's tokens and every worker answer is silently dropped (0 tokens).
  - *Which node*: with subgraphs on, a worker's tokens carry a **checkpoint-namespace prefix** of the parent node name (e.g. `order:<uuid>|agent:<uuid>`). `_worker_from_ns` scans the `|`-separated segments and returns the worker if one is present. The router's `with_structured_output` JSON streams under the `router` namespace → `_worker_from_ns` returns None → filtered out (no user-facing tokens).
  - *Where the text is*: `_chunk_text` reads the chunk's `.text` property first, then falls back to flattening `.content`. This covers both providers — OpenAI streams text in `.content` (a string), whereas a tool-capable Gemini `AIMessageChunk` leaves `.content == ""` and carries the text in `.text` / `content_blocks` (relevant if the code is switched back to Gemini).
  - The assistant turn is persisted from the SSE handler tagged `agent = <worker>` (the ns-derived worker of the streamed tokens).
  - **Model override**: `CHAT_MODEL` env var (default `gpt-4o-mini`) selects the chat/router model without code changes.
- **recall** is a Phase 1 pass-through (Mem0 / rolling summary are Phase 3). **No** write tools, HITL, or escalation yet — those are Phases 2–3.

### Chatbot (Phase 2) — write actions + HITL + escalation

Phase 2 gives the bot the ability to **act** on the user's behalf under human confirmation, and to **hand off to a human**. It is live in `routes/chat.py` (graph, HITL, escalation), the MCP write tools, new gap REST endpoints, and `ChatWidget.tsx` (confirm card, image upload, talk-to-human).

- **Graph**: `START → recall → router → {order|product|promotion|account|payment|returns|support|faq} → END`, now compiled **with an `AsyncPostgresSaver` checkpointer** on `DATABASE_URL` (thread_id = `chats.id`). `ChatState` adds `chat_id`, `hitl_pending`, `escalated`. Two new workers: **Returns & Refunds** and **Support & Escalation**; `INTENTS`/`ROUTER_PROMPT` extended with `returns` + `support`.
- **Gap REST endpoints** (all `@token_required`, user-scoped, ownership-guarded, foreign ids 404): `returns.py` (`POST/GET /returns`, `GET /returns/<id>`), `tickets.py` (multipart `POST /tickets` → file under `backend/uploads/`, `GET /tickets`, static serve at `/tickets/uploads/<name>`), `addresses.py` (CRUD), `orders.py` (+user `POST /orders/<id>/cancel` pre-shipment-only 409, `PATCH /orders/<id>` pending/paid-only), `users.py` (+`GET/PUT /users/me`, demo `POST /users/password-reset` returning the token), `coupons.py` (+`POST /coupons/validate` reusing `utils/place_order.validate_coupon`). Migrations `0005_returns`–`0008_password_reset_tokens`.
- **MCP write tools** (thin REST wrappers, golden rule holds — JWT over HTTP, never the DB): `cancel_order`, `modify_order`, `create_return`/`get_returns`/`get_return_status`, `create_ticket`/`upload_attachment`/`get_tickets`, `get_profile`/`update_profile`/`list_addresses`/`add_address`/`request_password_reset`, `validate_coupon`. `client.py` gained `rest_post`/`rest_patch`/`rest_put`/`rest_post_multipart`.
- **HITL Kind A (confirm/deny)**: write agents receive **local confirmation-wrapped tools** (`make_confirm_tool`), NOT the raw MCP write tools. The wrapper calls `interrupt({kind,action,args,summary})`; the SSE handler detects the pause via `graph.aget_state(...).tasks[*].interrupts` and emits a new **`event: interrupt`** frame instead of `event: done` (persisting an `[awaiting confirmation: …]` marker). The new **`POST /chat/resume`** (`@token_required`, body `{session_id, approved}`) resumes the same `thread_id` with `Command(resume={"approved": …})` and streams the continuation; the real MCP write fires only on approval. HITL-gated actions: `cancel_order`, `modify_order`, `create_return`, `validate_coupon`, `add_address`, `update_profile`, `request_password_reset`. Write-agent prompts explicitly tell the model **not** to ask for text confirmation — call the tool directly; the card is shown automatically. Because pause/resume are two separate Flask requests (each on its own event loop), the checkpointer is an `AsyncPostgresSaver.from_conn_string(DATABASE_URL)` built **inside** each request's `agen()` async-with block; `app.py` runs `saver.setup()` once at boot (idempotent). Verified to survive a full Flask restart mid-pause.
- **HITL Kind B (escalation)**: the Support agent has an in-process `escalate_to_human(summary, reason)` tool (no `interrupt()` — handoff is immediate) that files a ticket via `create_ticket` (REST) and calls `_mark_escalated` (direct DB: sets `chats.escalated=true, status='escalated'` and inserts a `[Escalated from chatbot] …` row into `support_messages`). Triggers: explicit "talk to a human", serious complaint, abusive/sensitive content. **Bot-silent-on-escalated-thread**: `/chat/stream` checks `_is_escalated(chat_id)` up front; if escalated it does not invoke the graph — it bridges the user's message into `support_messages` and emits `event: escalated` + `event: done`. The existing admin support view (`/support/messages/<user_id>`, `/support/reply/<user_id>`) needs no changes.
- **New SSE frames** (contract otherwise unchanged from Phase 0/1): `event: interrupt` (`{action, args, summary}`) → widget renders a Confirm/Cancel card that POSTs `/chat/resume`; `event: escalated` (`{session_id}`) → widget switches to the Human-support tab. The async→sync bridge is factored into a shared `_bridge(agen)` used by both `/stream` and `/resume`.
- **Frontend** (`ChatWidget.tsx`): the SSE reader is factored into `readSse()` (shared by `sendBot` and `resolveConfirm`); an `interrupt` branch renders the confirm/deny card, `escalated` flips to the Human tab. New affordances in the Assistant tab: a **🙋 Talk to a human** button and a **📎 Attach photo (damaged item)** file input (multipart `POST /tickets`, story 8).

### Database Schema (key tables)

`users`, `products`, `carts` / `cart_items`, `orders` / `order_items`, `payment_methods` / `payments`, `coupons` / `coupon_redemptions`, `reviews`, `support_messages`. Notable constraints: `order_items.subtotal` is a generated column; one review per user per product; one coupon redemption per user per coupon.

---

## Environment Variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://...
SECRET_KEY=<jwt-signing-secret>

# Chatbot (Phase 0)
GOOGLE_API_KEY=<gemini-api-key>          # embeddings + gemini-2.5-flash
MCP_SERVER_URL=http://localhost:8900     # FastMCP sidecar
BACKEND_URL=http://localhost:5001        # where MCP tools call the REST layer

# Later phases (placeholders)
MEM0_API_KEY=
LANGSMITH_API_KEY=
```

**Frontend** (`.env.local` or deployment env):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000   # must match the port in backend/app.py
```

---

## Key Conventions

- **Admin access**: Determined by `role` field on the `users` table (`'user'` | `'admin'`). The frontend reads the decoded JWT; the backend enforces via `@admin_required`.
- **Currency**: All prices stored and displayed in PKR. Formatting utility at `frontend/lib/format.ts`.
- **Image domains**: Remote image hostnames must be added to `frontend/next.config.ts` under `images.remotePatterns`.
- **Adding a migration**: Create a SQL file in `backend/migrations/` (remember: applied in alphabetical order), then run `uv run python migrate.py` — or just restart the backend.
- **Adding a backend route**: Create a Blueprint file in `backend/routes/`, then register it in `app.py` with `app.register_blueprint(...)`.
