# AI Agent Instructions — LabourBook (AgroLedger)

Welcome, AI Agent. This document outlines critical rules, architecture pointers, and guidelines for working on the **LabourBook** repository.

---

## 1. Ground Truth & Master Context

Before proposing or making changes, read the master project specification:
📄 **[PROJECT_CONTEXT.md](file:///d:/Dev/Labour%20Book/PROJECT_CONTEXT.md)**

It provides comprehensive documentation on:
- Domain context (Grape farming & agricultural labor in India).
- Database schema (PostgreSQL / SQLAlchemy Async / Alembic).
- All Backend REST API endpoints (`/api/v1/*`).
- Frontend Next.js 16 (App Router) + Tailwind CSS v4 design tokens and page layouts.
- Mobile Expo SDK 58 / React Native architecture, navigation stacks, and native modules.
- Financial formulas (Individual daily wage, Team 3-component formula, Contract per-acre amounts, Double-entry statement balances).
- Multi-language localization system (`en`, `hi`, `mr`).

---

## 2. Directory Quick Reference

| Directory | Role | Primary Commands |
|---|---|---|
| `backend/` | FastAPI REST API | Activate `.venv\Scripts\activate` & `python run.py` |
| `frontend/` | Next.js 16 Web Application | `npm run dev` / `npm run build` / `npm run lint` |
| `mobile/` | Expo SDK 58 React Native Mobile App | `npx expo start` / `npx tsc --noEmit` / `npx expo lint` |
| `Build resources/` | Design reference exports, Stitch UI packs & requirement PDFs | Reference only |

---

## 3. Strict Operating Invariants for AI Agents

1. **Owner-Based Isolation (Security):**
   - Every single backend table except `users` has an `owner_id` column referencing `users.id`.
   - Every router query MUST filter by `owner_id == current_user.id`.
   - Never allow user A to see, edit, or delete user B's workers, teams, plots, or payments.

2. **Entity Types (Individual vs. Team):**
   - The platform treats Individual Workers and Labour Teams as distinct entities that can both receive attendance, contracts, and payments.
   - Always enforce XOR constraints (`labour_id` is set XOR `team_id` is set).
   - Team wage formula: `(num_labourers * daily_wage) + car_rent + manager_fee`.

3. **Financial Precision:**
   - Store all money in database as `Numeric(10, 2)` or `Numeric(12, 2)`.
   - Format all currency in the UI as Indian Rupee (INR `₹`) using Indian numbering formatting (`₹1,50,000`).

4. **Design & Styling Rules:**
   - Palette: Deep Forest Green (`#012d1d`), Mint Fixed (`#c1ecd4`), Terracotta/Debt (`#510900`), Warm Off-white (`#fcf9f8`).
   - Match existing component conventions (clean cards, responsive tables, modal flows).
   - Do not add Tailwind arbitrary hex colors when theme CSS variables are available.

5. **Multi-Language (i18n):**
   - Never hardcode user-facing strings.
   - Add new strings to `frontend/lib/i18n/` and `mobile/lib/i18n.ts` under appropriate namespaces for `en`, `hi`, and `mr`.

6. **Mobile Package Management:**
   - Always install mobile dependencies with `npx expo install <package>` (not `npm install`) to ensure Expo SDK 58 compatibility.
   - Never hand-edit `ios/` or `android/` folders.

---

## 4. Running the Dev Environment

Run `start-dev.bat` from the root to launch all three services concurrently:
- Backend: `http://localhost:8000` (Interactive Swagger docs: `http://localhost:8000/docs`)
- Frontend: `http://localhost:3000`
- Mobile: Metro Bundler on `http://localhost:8081`
