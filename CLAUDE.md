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
- **Model**: Gemini — `gemini-2.5-flash` (chat) + `gemini-embedding-001` at **768 dims** (RAG). Env key `GOOGLE_API_KEY`. **Do not introduce OpenAI.**
- **MCP sidecar** (`mcp_server/server.py`, FastMCP on :8900, streamable-HTTP): exposes `get_orders` (user-scoped — calls `GET /orders/` over HTTP carrying the caller's JWT, so `@token_required` stays the single auth choke point; MCP never touches the DB for user data) and `search_knowledge_base` (shared-KB pgvector cosine search — the one allowed direct-DB tool). The chat blueprint is the MCP client via `langchain-mcp-adapters`, forwarding the end-user JWT as an `Authorization` header on the MCP connection.
- **RAG store**: `kb_documents` (pgvector `vector(768)`, ivfflat cosine index). Ingest with `ingest_kb.py` (idempotent, dedupes by `(source, chunk_hash)`); source docs under `backend/kb/`.
- **New tables** (migrations `0001`–`0003`): `vector` extension, `chats`, `chat_messages`, `kb_documents`.
- **Async bridge**: LangGraph/MCP are async, Flask is sync WSGI. The SSE generator pumps the async token stream through a dedicated event loop. Run under gunicorn+gevent/threads in prod.
- **Frontend**: `frontend/components/ChatWidget.tsx` (extracted from `page.tsx`) has an **Assistant** tab (bot, `POST /chat/stream` via `fetch` + `ReadableStream` — not `EventSource`, which is GET-only) and a **Human support** tab (the existing `/support/*` path, kept intact for Phase 2 escalation). Session id persisted in `localStorage` as `chat_session_id`.

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
