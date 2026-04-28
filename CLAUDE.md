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
npm run lint       # ESLint
```

### Backend (`backend/`)

```bash
uv sync            # install dependencies (first time, requires uv)
uv run python app.py          # development server on :5000
uv run python migrate.py      # run pending DB migrations
```

No test suite is currently configured for either project.

---

## Architecture

### Frontend

- **Framework**: Next.js App Router (`frontend/app/`). All pages are React Server Components by default; client interactivity uses `"use client"`.
- **Routing**: File-system based. Public routes live at the top level; `admin/` routes are protected by a client-side role check that redirects non-admins.
- **State**: Zustand stores in `frontend/store/` — `cartStore.ts` (persisted to localStorage) and `couponStore.ts`.
- **API calls**: Axios, pointed at `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:5000` when unset). All authenticated requests attach `Authorization: Bearer <token>` from localStorage.
- **Auth**: JWT decoded client-side with `jwt-decode`. Token stored in localStorage with a 2-hour TTL set by the backend.
- **UI**: Tailwind CSS v4 + Radix UI primitives + Shadcn/ui components (in `frontend/components/ui/`). Framer Motion for animations.
- **Validation**: React Hook Form + Zod on all forms.

### Backend

- **Framework**: Flask with Blueprint-per-resource routing. All blueprints registered in `app.py`.
- **Database**: PostgreSQL (Neon hosted). Direct `psycopg2` connections — no ORM. Connection helper in `database.py`.
- **Auth middleware**: `auth_middleware.py` provides `@token_required` (validates JWT, attaches user dict to `g`) and `@admin_required` (role check on top of token check).
- **Migrations**: SQL files in `migrations/`; `migrate.py` runs them and tracks applied migrations in a `schema_migrations` table.
- **CORS**: Configured in `app.py` to allow the localhost dev origin and two production origins (Vercel + GitHub Codespaces).

### API Surface

| Blueprint | Prefix | Key responsibilities |
|-----------|--------|---------------------|
| users | `/users` | register, login, list users (admin) |
| products | `/products` | product CRUD (admin write) |
| carts | `/carts` | per-user cart read/write |
| orders | `/orders` | checkout, order history, status management |
| payments | `/payments` | payment methods, process payment |
| coupons | `/coupons` | validate code, active list, CRUD (admin) |
| reviews | `/reviews` | post & fetch product reviews |
| support | `/support` | user↔admin support messaging |
| stats | `/stats` | admin dashboard aggregates |

### Database Schema (key tables)

`users`, `products`, `carts` / `cart_items`, `orders` / `order_items`, `payment_methods` / `payments`, `coupons` / `coupon_redemptions`, `reviews`, `support_messages`.

---

## Environment Variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://...
SECRET_KEY=<jwt-signing-secret>
```

**Frontend** (`.env.local` or deployment env):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

---

## Key Conventions

- **Admin access**: Determined by `role` field on the `users` table (`'user'` | `'admin'`). The frontend reads the decoded JWT; the backend enforces via `@admin_required`.
- **Currency**: All prices stored and displayed in PKR. Formatting utility at `frontend/lib/format.ts`.
- **Image domains**: Remote image hostnames must be added to `frontend/next.config.ts` under `images.remotePatterns`.
- **Adding a migration**: Create a numbered SQL file in `backend/migrations/`, then run `uv run python migrate.py`.
- **Adding a backend route**: Create a Blueprint file in `backend/routes/`, then register it in `app.py` with `app.register_blueprint(...)`.
