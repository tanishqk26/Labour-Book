# KhetKitab (AgroLedger) — Handoff Context for Another AI Agent

Farm labour & operations management for Indian grape farmers. Web + Mobile + REST API. Languages: English, Hindi, Marathi. Repo: https://github.com/tanishqk26/Labour-Book (branch `main`). Local path: `D:\Dev\Labour Book` (Windows 11).

> Fuller spec lives in `PROJECT_CONTEXT.md` (schema, every endpoint, UI details) and rules in `AGENTS.md`. This file is the condensed version plus deployment.

## 1. Domain
- **Individual workers (labours):** daily wage, half-day = 50%.
- **Teams (tolis, led by a mukadam):** daily wage = `(num_labourers × daily_wage) + car_rent + manager_fee`.
- **Contracts (theka/uchkhal):** lump sum or `amount_per_acre × plot.size_acres`. Attendance with `wage_type="contract"` earns ₹0 (settled via the contract).
- **Payments/advances:** cash/UPI/bank/other. Balance = Total Earned − Total Paid (>0 farmer owes worker; <0 worker holds advance).
- **Farm year:** Apr 1 → Mar 31. Two lifecycle stages per plot: Vegetative (April pruning) and Fruit Production (October pruning, transition date default Oct 1). Plot operations (spraying, irrigation, etc.) carry workers and up to 5 photos.

## 2. Tech Stack
| Layer | Stack |
|---|---|
| Backend | Python 3.12+, FastAPI 0.115, Uvicorn 0.30, SQLAlchemy 2.0.36 (async), psycopg 3 (binary), Alembic 1.13, Pydantic v2 + pydantic-settings, PyJWT, bcrypt, google-auth, httpx, pytest + pytest-asyncio |
| Database | PostgreSQL 15+ (Supabase-hosted in prod; local Postgres in dev) |
| Storage | Supabase Storage bucket `operation-photos` (max 5 photos/operation) |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Mobile | Expo SDK 58, React Native 0.88, React 19, React Navigation (native stack + bottom tabs), expo-secure-store, async-storage, expo-image-picker, expo-print, expo-sharing |
| Auth | Google Sign-In + email/password (bcrypt), own JWT (30-day). Web: httpOnly cookie `lb_session`. Mobile: `Authorization: Bearer` (token in SecureStore) |

## 3. Repo Layout
```
backend/   FastAPI: main.py, run.py, app/{config,database,core,models,routers,schemas}, alembic/, tests/, supabase_manual_restore.sql
frontend/  Next.js: app/(auth), app/(app)/{dashboard,attendance,labours,teams,contracts,payments,plots,operations,statements,settings}, components, context, lib/{api.ts,i18n}, types
mobile/    Expo: App.tsx, app.json, eas.json, screens/, components/, context/, lib/{api.ts,i18n.ts,theme.ts}
Build resources/  design exports, reference only
start-dev.bat     launches all three services
```

## 4. Deployment (current)
| Piece | Where | Notes |
|---|---|---|
| Backend API | **Render** web service → `https://labour-book.onrender.com` | Hard-coded in `mobile/eas.json` for both `preview` and `production` profiles. Free-tier-style cold starts likely; a `HEAD /health` endpoint exists to keep it warm/ping. |
| Database | **Supabase Postgres** (inferred from `backend/supabase_manual_restore.sql` and docs; "Supabase / Render / Local" all listed as options) | Schema managed by Alembic (`alembic upgrade head`). |
| Photo storage | **Supabase Storage** | Env: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_BUCKET_NAME`. |
| Web frontend | **Vercel** (inferred from commit "fix(frontend): wrap useSearchParams page in Suspense to fix Vercel build"). No `vercel.json`. | Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. |
| Mobile | **EAS Build** (project id `5a72ee84-ef05-4098-a241-b362541454a3`) | `preview` → Android APK; `production` → Android AAB (+ iOS). Android package / iOS bundle ID: `com.labourbook.app`; app name "KhetKitab", slug `labourbook`. |

**Cross-origin cookie note:** web (Vercel) and API (Render) are on different domains, so in non-dev the session cookie is set `HttpOnly`, `Secure`, `SameSite=None` (see `backend/app/routers/auth.py` `_set_session_cookie`). CORS in production uses only `CORS_ORIGINS` (the localhost/LAN regex applies only when `APP_ENV=development`).

**Not found in the repo (ask the owner if needed):** Render build/start commands & service settings (no `render.yaml`/Dockerfile/Procfile), exact Vercel project/domain, production Supabase project, whether Alembic runs automatically on deploy, CI/CD config (none present), Google OAuth authorized origins for prod.

## 5. Environment Variables
**Backend `.env`**: `APP_ENV` (development|production), `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` (43200), `DATABASE_URL` (`postgresql+psycopg://user:pw@host:5432/db`), `GOOGLE_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_BUCKET_NAME`, `CORS_ORIGINS` (comma-separated or JSON list).
**Frontend `.env.local`**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
**Mobile `.env`**: `EXPO_PUBLIC_API_URL` (LAN IP for dev; Render URL baked in via EAS profiles).

## 6. Run Locally
- All: `start-dev.bat` (root).
- Backend: `cd backend; .venv\Scripts\activate; python run.py` → http://localhost:8000 (Swagger `/docs`)
- Web: `cd frontend; npm run dev` → :3000 (`npm run build`, `npm run lint`)
- Mobile: `cd mobile; npx expo start` → :8081 (`npx tsc --noEmit`, `npx expo lint`)
- Migrations: `alembic revision --autogenerate -m "msg"` then `alembic upgrade head`
- Tests: `pytest` in `backend/`

## 7. API Summary (`/api/v1`)
`/auth` (google, signup, login, me, profile, change-password, logout) · `/labours` · `/teams` (+`/members`) · `/attendance` (daily, bulk, history, per-entity history, PATCH/DELETE) · `/payments` (+`/entities`, `/summary`) · `/statements` (work, payment, combined) · `/contracts` · `/plots` · `/farm-years` · `/plot-operations` (+`/photos`, `/workers`) · `GET|HEAD /health` (unauthenticated). Everything else requires cookie or Bearer token.

## 8. Data Model (all tables except `users` have `owner_id → users.id ON DELETE CASCADE`)
`users`, `labours`, `teams` (+`team_labours` M:N), `attendances` (unique `(labour_id,date)` and `(team_id,date)`), `contracts`, `payments`, `plots`, `farm_years` (unique `(owner_id,year)`), `plot_farm_years`, `plot_lifecycles`, `plot_operations`, `plot_operation_workers`, `plot_operation_photos`. Money = `Numeric(10,2)`/`Numeric(12,2)`.

## 9. Non-Negotiable Rules
1. **Multi-tenancy:** every query filters `owner_id == current_user.id`; never leak or mutate another user's data.
2. **XOR:** attendance/payment/contract targets have `labour_id` XOR `team_id`.
3. **Money:** Numeric in DB; UI formatted as INR with Indian grouping (`₹1,50,000`, `Intl.NumberFormat('en-IN')`); round to 2 decimals.
4. **Design:** Palette — Forest Green `#012d1d`, Emerald `#1b4332`, Mint `#c1ecd4`, Terracotta/debt `#510900`, Off-white `#fcf9f8`. Use theme CSS variables, not arbitrary hex; reuse `DatePicker`/`TimePicker`/`Select`/`PaymentModal`.
5. **i18n:** no hardcoded strings; add keys to `frontend/lib/i18n/` and `mobile/lib/i18n.ts` for `en`, `hi`, `mr` (missing keys fall back to `en`).
6. **Mobile:** install deps with `npx expo install`; never hand-edit `ios/` or `android/` (CNG via `app.json`).
7. **Windows:** keep `WindowsSelectorEventLoopPolicy` in `backend/main.py` (psycopg async requirement).
8. Next.js 16 has breaking changes vs. older versions — check `frontend/AGENTS.md`/`CLAUDE.md` before writing frontend code.

## 10. Recent History
`d4afdfc` Suspense fix for Vercel build · `ec39323` rename to KhetKitab · `8a7c894` mobile instant attendance + branding · `3037f85` frontend faster loading, password toggle, new logo · `72f5768` backend fewer DB round-trips, `HEAD /health`.
