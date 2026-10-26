# LabourBook (AgroLedger) — Comprehensive Project Context & Technical Specification

> **Target Audience:** Autonomous AI Agents, LLM Coding Assistants, and Human Software Engineers.  
> **Last Updated:** October 2026  
> **Project Scope:** Multi-platform Farm Labour, Operation & Financial Management System (Web + Mobile + Backend API).

---

## 1. Executive Summary & Domain Context

**LabourBook** is a specialized Farm Labour & Agricultural Operations Management Platform built primarily for high-value horticulture (specifically **grape farming**, with extensibility to other fruit orchards and crops). 

### 1.1 The Problem It Solves
Grape farming in India (e.g., Maharashtra regions like Nashik, Sangli, Solapur) involves complex seasonal labor dynamics:
- **Daily Labourers (Individual Workers):** Work on fixed daily wages, half-day rates, or custom hours.
- **Contracted Labour Teams (Tolis / Gangs):** Managed by a team leader/Mukadam. Teams charge a combined rate: `(Headcount × Daily Rate) + Fixed Car/Vehicle Rent + Manager Commission Fee`.
- **Contract Work (Uchkhal / Theka):** Fixed-sum or per-acre contracts for specialized tasks like pruning (*Chhatni*), dipping, girdling, thinning, and harvesting.
- **Cash Advances & Financial Settlements:** Farmers frequently disburse informal cash or UPI advances to workers before and during the season. Tracking credit vs. debit ledgers across dozens of workers and teams without errors is critical.
- **Grape Crop Lifecycle & Field Operations:** Grape farming follows a strict annual biological cycle (April 1 to March 31 of next year), split into **Vegetative / Shoot Development** (April pruning) and **Fruit Production / Harvest** (October pruning). Daily operations (spraying, fertilizer, irrigation, canopy management) must be tracked per plot with photo proof and worker logs.

### 1.2 Target Personas & Languages
- **Grape Farmers / Estate Owners:** Need fast daily roll call (under 60 seconds), instant balance calculation, advance tracking, and printable statements for settlement.
- **Supported Languages:** **English (`en`)**, **Hindi (`hi`)**, and **Marathi (`mr`)**. The app defaults to English but features 100% localization across UI strings.

---

## 2. High-Level System Architecture

LabourBook is architected as a modern, decoupled three-tier system:

```mermaid
graph TD
    subgraph Client Tier
        W[Web App: Next.js 16 + React 19 + Tailwind CSS v4]
        M[Mobile App: Expo SDK 58 + React Native 0.88 + React 19]
    end

    subgraph API & Backend Tier
        API[FastAPI Async REST API - Python 3.12+]
        AUTH[Auth Engine: Google OAuth + Bcrypt JWT]
    end

    subgraph Data & Storage Tier
        DB[(PostgreSQL Database via SQLAlchemy Async / Alembic)]
        STORAGE[Supabase Storage: Operation Photos Bucket]
    end

    W -->|REST + HTTP-only Cookie / Bearer JWT| API
    M -->|REST + Bearer Authorization Header| API
    API --> AUTH
    API --> DB
    API --> STORAGE
```

### 2.1 Technology Stack & Versions
| Layer | Technologies & Libraries | Key Versions |
|---|---|---|
| **Backend API** | FastAPI, Uvicorn, SQLAlchemy (Asyncio), psycopg[binary], Alembic, Pydantic v2 | Python 3.12+, FastAPI 0.115, SQLAlchemy 2.0.36 |
| **Database** | PostgreSQL (Supabase / Render / Local) | PostgreSQL 15+ |
| **Frontend Web** | Next.js (App Router), React, Tailwind CSS v4, TypeScript | Next.js 16.3, React 19.2, Tailwind v4 |
| **Mobile App** | Expo (CNG), React Native, React Navigation (Native Stack + Bottom Tabs), Expo Secure Store | Expo SDK 58, RN 0.88, React 19.3 |
| **Auth** | JWT (PyJWT), Google Sign-In (`google-auth`), Passlib / Bcrypt | 30-Day Session Lifetime |
| **Storage** | Supabase Storage (S3-compatible bucket for operation photos) | Max 5 photos per operation |

---

## 3. Repository Directory Structure

```
d:\Dev\Labour Book\
├── backend/                  # FastAPI Application
│   ├── alembic/              # Database migration versions
│   │   ├── versions/         # Incremental migration scripts
│   │   └── env.py
│   ├── app/
│   │   ├── config.py         # Pydantic Settings (.env loader)
│   │   ├── database.py       # Async SQLAlchemy engine & sessionmaker
│   │   ├── core/
│   │   │   ├── deps.py       # Authentication dependency (get_current_user)
│   │   │   ├── security.py   # JWT encoding/decoding, bcrypt password hashing
│   │   │   └── storage.py    # Supabase storage client for photos
│   │   ├── models/           # SQLAlchemy 2.0 ORM models
│   │   ├── routers/          # FastAPI APIRouters (endpoints)
│   │   └── schemas/          # Pydantic request & response models
│   ├── main.py               # FastAPI entrypoint & CORS middleware
│   ├── run.py                # Development runner (port 8000)
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # Next.js 16 Web Application
│   ├── app/                  # App Router
│   │   ├── (auth)/           # Login & Signup routes
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (app)/            # Authenticated application layout & pages
│   │   │   ├── attendance/   # Weekly attendance sheet & daily roll call
│   │   │   ├── contracts/    # Fixed/Per-acre contract management
│   │   │   ├── dashboard/    # Primary analytics, KPI cards & quick actions
│   │   │   ├── labours/      # Individual worker management & profiles
│   │   │   ├── operations/   # Plot operations stream & season timeline
│   │   │   ├── payments/     # Cash advances & payment ledger
│   │   │   ├── plots/        # Physical plot management & acreages
│   │   │   ├── settings/     # Profile, password, language selection
│   │   │   ├── statements/   # Work, payment & combined statement generator
│   │   │   └── teams/        # Labour teams & Mukadam management
│   │   ├── globals.css       # Tailwind v4 theme & Material 3 CSS variables
│   │   └── layout.tsx        # Root HTML layout with Providers
│   ├── components/           # Reusable UI components & modals
│   │   ├── ui/               # DatePicker, TimePicker, Select
│   │   ├── LabourCard.tsx    # Worker display card
│   │   ├── LabourModal.tsx   # Add/Edit worker modal
│   │   ├── PaymentModal.tsx  # Add/Edit payment/advance modal
│   │   ├── Sidebar.tsx       # Desktop 280px navigation sidebar
│   │   ├── MobileNav.tsx     # Mobile web bottom nav bar
│   │   └── WeeklyAttendanceSheet.tsx # Excel-style attendance matrix
│   ├── context/              # React Context (AuthContext, LanguageContext)
│   ├── lib/
│   │   ├── api.ts            # Fetch wrapper with auto-token handling
│   │   └── i18n/             # en, hi, mr translation dictionaries
│   └── types/                # Shared TypeScript models and interfaces
│
├── mobile/                   # Expo React Native Mobile Application
│   ├── App.tsx               # Root component with Tab & Stack Navigators
│   ├── app.json              # Expo configuration (bundle ID, permissions)
│   ├── eas.json              # EAS cloud build profiles (preview, production)
│   ├── context/              # Mobile AuthContext & LanguageContext
│   ├── lib/                  # api.ts, i18n.ts, theme.ts (design tokens)
│   ├── components/           # AppHeader, ClockPicker, PaymentModal
│   └── screens/              # Screen components
│       ├── auth/             # LoginScreen.tsx
│       ├── tabs/             # Dashboard, People, Attendance, Operations, More
│       ├── details/          # LabourDetail, TeamDetail, OperationDetail
│       ├── contracts/        # ContractsScreen, ContractDetailScreen
│       ├── payments/         # PaymentsScreen
│       ├── plots/            # PlotsScreen
│       ├── settings/         # SettingsScreen
│       └── statements/       # StatementsScreen
│
├── Build resources/          # UI mockups, feature specs, Stitch design exports
├── start-dev.bat             # 1-click concurrent launcher (Backend + Web + Expo)
├── PROJECT_CONTEXT.md        # Master specification document (this file)
└── README.md                 # Quick start guide
```

---

## 4. Comprehensive Data Models & Database Schema

Every business entity is tied to `owner_id` (foreign key to `users.id` with `CASCADE` delete). This enforces strict tenant data isolation.

```mermaid
erDiagram
    USERS ||--o{ LABOURS : owns
    USERS ||--o{ TEAMS : owns
    USERS ||--o{ ATTENDANCES : owns
    USERS ||--o{ CONTRACTS : owns
    USERS ||--o{ PLOTS : owns
    USERS ||--o{ PAYMENTS : owns
    USERS ||--o{ FARM_YEARS : owns
    USERS ||--o{ PLOT_OPERATIONS : owns

    TEAMS }|--|{ LABOURS : "team_labours (M:N)"
    LABOURS ||--o{ ATTENDANCES : "receives"
    TEAMS ||--o{ ATTENDANCES : "receives"
    CONTRACTS ||--o{ ATTENDANCES : "links (contract work)"
    PLOTS ||--o{ CONTRACTS : "associates (acre rate)"

    PLOTS ||--o{ PLOT_FARM_YEARS : "enrolled in"
    FARM_YEARS ||--o{ PLOT_FARM_YEARS : "groups"
    PLOT_FARM_YEARS ||--o{ PLOT_LIFECYCLES : "has stages"
    PLOT_LIFECYCLES ||--o{ PLOT_OPERATIONS : "scopes"
    PLOTS ||--o{ PLOT_OPERATIONS : "located on"

    PLOT_OPERATIONS ||--o{ PLOT_OPERATION_WORKERS : "assigned"
    PLOT_OPERATIONS ||--o{ PLOT_OPERATION_PHOTOS : "contains"
    LABOURS ||--o{ PLOT_OPERATION_WORKERS : "works"
    TEAMS ||--o{ PLOT_OPERATION_WORKERS : "works"

    LABOURS ||--o{ PAYMENTS : "paid to"
    TEAMS ||--o{ PAYMENTS : "paid to"
```

### 4.1 Detailed Table Definitions

#### `users`
App accounts. Supports Google OAuth, email/password, or both linked.
- `id`: `UUID` (PK)
- `email`: `VARCHAR(255)` (Unique, Indexed)
- `name`: `VARCHAR(255)`
- `google_sub`: `VARCHAR(255)` (Nullable, Unique, Indexed)
- `password_hash`: `VARCHAR(255)` (Nullable, Bcrypt)
- `picture_url`: `VARCHAR(500)` (Nullable)
- `phone`: `VARCHAR(20)` (Nullable)
- `is_active`: `BOOLEAN` (Default: `true`)
- `created_at`, `last_login_at`: `TIMESTAMPTZ`

#### `labours` (Individual Workers)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`, ON DELETE CASCADE)
- `name`: `VARCHAR(100)` (Indexed)
- `hometown`: `VARCHAR(100)` (Village / town of origin)
- `phone`: `VARCHAR(20)`
- `aadhaar`: `VARCHAR(20)` (National ID)
- `daily_wage`: `NUMERIC(10, 2)` (Standard daily pay rate in INR)
- `work_start_time`: `VARCHAR(5)` (e.g. `"08:00"`)
- `work_end_time`: `VARCHAR(5)` (e.g. `"17:00"`)
- `is_active`: `BOOLEAN` (Soft-delete flag)

#### `teams` (Contracted Labour Groups / Tolis)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`, ON DELETE CASCADE)
- `name`: `VARCHAR(100)` (e.g. "Ramesh Mukadam Gang")
- `hometown`: `VARCHAR(100)`
- `description`: `VARCHAR(255)`
- `daily_wage`: `NUMERIC(10, 2)` (Per-worker rate)
- `car_rent`: `NUMERIC(10, 2)` (Fixed transport charge per day)
- `manager_fee`: `NUMERIC(10, 2)` (Mukadam / commission charge per day)
- `is_active`: `BOOLEAN` (Soft-delete flag)
- `team_labours`: Junction table (`team_id`, `labour_id`) for member associations.

#### `attendances` (Daily Work Logs)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`, ON DELETE CASCADE)
- `labour_id`: `UUID` (FK -> `labours.id`, Nullable)
- `team_id`: `UUID` (FK -> `teams.id`, Nullable)
- `date`: `DATE` (Indexed)
- `status`: `VARCHAR(10)` (`"present"`, `"absent"`, `"half_day"`)
- `num_labourers`: `INTEGER` (Headcount for team attendance)
- `task`: `VARCHAR(200)` (Task description, e.g. "Berry Thinning")
- `hours_worked`: `NUMERIC(4, 1)`
- `work_start_time`, `work_end_time`: `VARCHAR(5)`
- `wage_earned`: `NUMERIC(10, 2)` (Snapshot of earned wage)
- `wage_type`: `VARCHAR(20)` (`"daily"` or `"contract"`)
- `contract_id`: `UUID` (FK -> `contracts.id`, Nullable)
- **Constraints:**
  - `UniqueConstraint("labour_id", "date")`
  - `UniqueConstraint("team_id", "date")`

#### `contracts` (Fixed Price Work Assignments)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`, ON DELETE CASCADE)
- `title`: `VARCHAR(200)`
- `description`: `TEXT`
- `entity_type`: `VARCHAR(20)` (`"individual"` | `"team"`)
- `labour_id`, `team_id`: `UUID` (Target entity)
- `plot_id`: `UUID` (FK -> `plots.id`, Nullable)
- `amount_per_acre`: `NUMERIC(12, 2)` (Nullable)
- `amount`: `NUMERIC(12, 2)` (Total contract amount in INR)
- `assigned_date`, `completed_date`: `DATE`
- `status`: `VARCHAR(20)` (`"active"`, `"completed"`, `"cancelled"`)

#### `payments` (Financial Disbursements & Advances)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`, ON DELETE CASCADE)
- `labour_id`, `team_id`: `UUID` (Exactly one must be set)
- `date`: `DATE`
- `amount`: `NUMERIC(12, 2)` (INR transferred)
- `method`: `VARCHAR(30)` (`"cash"`, `"upi"`, `"bank_transfer"`, `"other"`)
- `notes`: `TEXT`

#### `plots` (Physical Fields)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`, ON DELETE CASCADE)
- `name`: `VARCHAR(100)` (e.g. "North Vineyard Block A")
- `size_acres`: `NUMERIC(8, 2)` (e.g. `2.50`)
- `crop_name`: `VARCHAR(100)` (Default: "Grapes")
- `notes`: `TEXT`
- `is_active`: `BOOLEAN`

#### `farm_years` (Annual Crop Cycles)
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`)
- `year`: `INTEGER` (The April-start year, e.g. 2026 covers 2026-04-01 to 2027-03-31)
- `start_date`: `DATE` (Always April 1 of `year`)
- `end_date`: `DATE` (Always March 31 of `year + 1`)
- `transition_date`: `DATE` (Boundary between Vegetative and Fruit stages; default Oct 1)
- **Constraint:** `UniqueConstraint("owner_id", "year")`

#### `plot_farm_years` & `plot_lifecycles`
- `plot_farm_years`: Joins `plot_id` and `farm_year_id` with `crop_name`, `variety` (e.g. "Thompson Seedless"), `acreage`, and `notes`.
- `plot_lifecycles`: Stages created automatically when a plot is enrolled into a farm year:
  1. `lifecycle_type = "vegetative"` (Shoot Development stage)
  2. `lifecycle_type = "fruit_production"` (Fruit Production & Harvest stage)

#### `plot_operations`
- `id`: `UUID` (PK)
- `owner_id`: `UUID` (FK -> `users.id`)
- `plot_id`: `UUID` (FK -> `plots.id`)
- `plot_lifecycle_id`: `UUID` (FK -> `plot_lifecycles.id`, Nullable)
- `operation_date`: `DATE`
- `operation_type`: `VARCHAR(200)` (`"irrigation"`, `"fertilizer"`, `"pesticide"`, `"fungicide"`, `"insecticide"`, `"leaf_removal"`, `"shoot_management"`, `"weeding"`, `"bunch_management"`, `"harvest"`, `"other"`)
- `notes`: `TEXT`

#### `plot_operation_workers`
- `id`: `UUID` (PK)
- `operation_id`: `UUID` (FK -> `plot_operations.id`, ON DELETE CASCADE)
- `labour_id`, `team_id`: `UUID` (XOR constraint: exactly one must be set)
- `hours_worked`: `NUMERIC(5, 2)`

#### `plot_operation_photos`
- `id`: `UUID` (PK)
- `operation_id`: `UUID` (FK -> `plot_operations.id`, ON DELETE CASCADE)
- `storage_path`: `VARCHAR(500)` (Path in Supabase Storage bucket)
- `caption`: `TEXT`
- `sort_order`: `INTEGER` (0-based)
- **Constraint:** Maximum 5 photos per operation.

---

## 5. Core Business Logic & Mathematical Formulas

### 5.1 Individual Labour Wage Calculation
```python
if attendance.status == "absent":
    wage = 0.0
elif attendance.status == "half_day":
    wage = round(labour.daily_wage / 2, 2)
elif attendance.status == "present":
    wage = round(labour.daily_wage, 2)

# If wage_type is "contract", daily wage earned is 0 (settled via contract amount)
if attendance.wage_type == "contract":
    wage = 0.0
```

### 5.2 Team Daily Wage Calculation
Teams operate on a 3-component formula:
$$\text{Team Wage} = (\text{num\_labourers} \times \text{daily\_wage}) + \text{car\_rent} + \text{manager\_fee}$$
- If `status == "absent"` or `num_labourers == 0`, wage = ₹0.00.
- If `wage_type == "contract"`, wage = ₹0.00 (settled via contract amount).

### 5.3 Contract Amount Calculation
For acre-based contracts:
$$\text{Contract Amount} = \text{amount\_per\_acre} \times \text{plot.size\_acres}$$
For lump-sum contracts:
$$\text{Contract Amount} = \text{fixed agreed amount}$$

### 5.4 Financial Statement & Balance Formulas
For any entity (individual labourer or team) over a date range:
1. **Total Earned:**
   $$\sum \text{Attendance.wage\_earned} + \sum \text{Contract.amount (for completed/active contracts)}$$
2. **Total Paid / Borrowed:**
   $$\sum \text{Payment.amount (actual disbursements)}$$
3. **Current Balance (Outstanding Debt / Credit):**
   $$\text{Balance} = \text{Total Earned} - \text{Total Paid}$$
   - Positive Balance ($> 0$): Farmer owes the worker money.
   - Negative Balance ($< 0$): Worker has taken advance money and owes work to the farmer.
   - Zero Balance ($= 0$): Fully settled.

---

## 6. Complete Backend REST API Reference

Base URL: `/api/v1`  
All endpoints except `/health` and `/auth/*` require authentication via session cookie or `Authorization: Bearer <token>`.

### 6.1 Authentication (`/auth`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/auth/google` | Google OAuth token sign-in/up | `{ credential: string }` | `UserRead` + JWT cookie/token |
| `POST` | `/auth/signup` | Email/password registration | `{ email, name, password }` | `UserRead` (HTTP 201) |
| `POST` | `/auth/login` | Email/password sign-in | `{ email, password }` | `UserRead` |
| `GET` | `/auth/me` | Fetch authenticated user | None | `UserRead` |
| `PATCH`| `/auth/profile` | Update user name & phone | `{ name, phone }` | `UserRead` |
| `POST` | `/auth/change-password` | Update account password | `{ current_password, new_password }` | `{ message: string }` |
| `POST` | `/auth/logout` | Delete session cookie | None | `{ message: "Logged out" }` |

### 6.2 Labours (`/labours`)
| Method | Endpoint | Description | Params / Body |
|---|---|---|---|
| `GET` | `/labours` | Paginated list of workers | `page`, `page_size`, `status` ("active"/"inactive"), `search` |
| `POST` | `/labours` | Create a new worker | `{ name, daily_wage, hometown?, phone?, aadhaar?, work_start_time?, work_end_time? }` |
| `GET` | `/labours/{id}` | Worker detail + attendances | None |
| `PATCH`| `/labours/{id}` | Update worker info / soft-delete | `LabourUpdate` schema |
| `DELETE`| `/labours/{id}` | Delete worker record | None |

### 6.3 Teams (`/teams`)
| Method | Endpoint | Description | Params / Body |
|---|---|---|---|
| `GET` | `/teams` | Paginated list of teams | `page`, `page_size`, `status`, `search` |
| `POST` | `/teams` | Create labour team | `{ name, daily_wage, car_rent, manager_fee, hometown?, description? }` |
| `GET` | `/teams/{id}` | Team detail with members | None |
| `PATCH`| `/teams/{id}` | Update team rates / info | `TeamUpdate` schema |
| `DELETE`| `/teams/{id}` | Soft-delete / delete team | None |
| `POST` | `/teams/{id}/members` | Add workers to team | `{ labour_ids: string[] }` |
| `DELETE`| `/teams/{id}/members` | Remove workers from team | `{ labour_ids: string[] }` |

### 6.4 Attendance (`/attendance`)
| Method | Endpoint | Description | Query / Body |
|---|---|---|---|
| `GET` | `/attendance/daily` | Today's or specific date's combined roll call (labours + teams) | `for_date` (YYYY-MM-DD) |
| `POST` | `/attendance/bulk` | Bulk upsert roll call for multiple workers and teams | `{ date, records: AttendanceRecordCreate[] }` |
| `POST` | `/attendance` | Single upsert attendance | `AttendanceCreate` schema |
| `GET` | `/attendance/history` | Paginated attendance logs with filters | `page`, `page_size`, `entity_type` ("labour"/"team"), `date_from`, `date_to` |
| `GET` | `/attendance/labour/{id}/history` | Specific worker's attendance history | `limit` (1-200) |
| `GET` | `/attendance/team/{id}/history` | Specific team's attendance history | `limit` (1-200) |
| `PATCH`| `/attendance/{id}` | Modify existing attendance record | `AttendanceUpdate` |
| `DELETE`| `/attendance/{id}` | Delete attendance record | None |

### 6.5 Payments & Financial Summaries (`/payments`)
| Method | Endpoint | Description | Query / Body |
|---|---|---|---|
| `GET` | `/payments` | Paginated payment transactions | `page`, `page_size`, `labour_id?`, `team_id?`, `date_from?`, `date_to?` |
| `POST` | `/payments` | Record payment/advance | `{ labour_id?, team_id?, date, amount, method, notes? }` |
| `GET` | `/payments/entities` | List all entities with total earned, total paid, pending balance, and payment status | None |
| `GET` | `/payments/summary` | Dashboard KPI summary (Total Earned, Total Paid, Total Pending, Paid This Month) | None |
| `PATCH`| `/payments/{id}` | Update payment transaction | `PaymentUpdate` |
| `DELETE`| `/payments/{id}` | Void payment record | None |

### 6.6 Statements (`/statements`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/statements/work` | Work Statement (attendance rows, hours, wages) | `entity_type`, `entity_id`, `date_from`, `date_to` |
| `GET` | `/statements/payment` | Payment Statement (credit vs. debits/advances) | `entity_type`, `entity_id`, `date_from`, `date_to` |
| `GET` | `/statements/combined` | Complete ledger statement with running balance | `entity_type`, `entity_id`, `date_from`, `date_to` |

### 6.7 Contracts (`/contracts`)
| Method | Endpoint | Description | Query / Body |
|---|---|---|---|
| `GET` | `/contracts` | List contracts | `status` ("active"/"completed"/"cancelled"), `entity_type`, `page`, `page_size` |
| `POST` | `/contracts` | Create contract | `{ title, entity_type, labour_id?, team_id?, plot_id?, amount_per_acre?, amount, assigned_date }` |
| `GET` | `/contracts/{id}` | Single contract detail | None |
| `PATCH`| `/contracts/{id}` | Update contract status/info | `ContractUpdate` |
| `DELETE`| `/contracts/{id}` | Cancel/delete contract | None |

### 6.8 Plots & Farm Years (`/plots`, `/farm-years`, `/plot-operations`)
- `/plots`: CRUD for farm blocks (acres, crop, notes).
- `/farm-years`: Create crop year, enroll plots, auto-create Vegetative & Fruit Production lifecycles.
- `/plot-operations`: Record daily farm operations with worker assignments.
- `/plot-operations/{id}/photos`: Upload up to 5 photos to Supabase Storage with reordering and captions.
- `/plot-operations/{id}/workers`: Link labourer or team with hours worked.

---

## 7. Frontend (Web) Architecture & UI Design

### 7.1 Design System & Material 3 Palette
The UI follows an **Agricultural Material Design 3** philosophy with high visual hierarchy, clean contrast, and subtle micro-interactions:

| Token Name | Hex Code | Semantic Role |
|---|---|---|
| `--color-primary` | `#012d1d` | Deep Forest Green — branding, primary buttons, headers |
| `--color-primary-container` | `#1b4332` | Dark Emerald — active states, badges |
| `--color-primary-fixed` | `#c1ecd4` | Mint Green — success states, positive cash balance |
| `--color-tertiary` | `#510900` | Burnt Clay / Crimson — debt warnings, negative balance, advance payouts |
| `--color-tertiary-fixed` | `#ffdad3` | Light terracotta chip background |
| `--color-secondary` | `#53606a` | Slate Blue-Gray — secondary actions, muted icons |
| `--color-background` | `#fcf9f8` | Warm Off-White / Alabaster background |
| `--color-surface-container`| `#f0eded` | Card backgrounds, list item containers |
| `--color-surface-container-lowest` | `#ffffff` | Pure white modal / card surfaces |

### 7.2 Web Navigation & Layout
- **Desktop (Viewport $\ge$ 768px):** Fixed left sidebar (`280px` width) displaying the logo, main navigation links with icons and badge counts, quick user profile with avatar, and language switcher. The `<main>` element automatically offsets by `280px`.
- **Mobile Web (Viewport $<$ 768px):** Top header with menu/actions + bottom fixed navigation bar (`64px` height) providing 1-tap thumb access to Dashboard, Attendance, Labours, Teams, and More.
- **View Toggle Preference:** Tables across Labours, Teams, and Payments support toggling between **Card Grid** and **Compact Table View**, persisted in `localStorage` via the `useListView` hook.

### 7.3 Key Web Pages & Workflows
1. **Dashboard (`/(app)/dashboard`):**
   - KPI Stat Cards: Present Headcount, Today's Wage Total, Completed Roll Call %, Outstanding Farmer Debt.
   - Quick Roll Call widget: Instant P/A toggles for today's workers.
   - Activity feed & recent advances disbursed.
2. **Attendance Weekly Sheet (`/(app)/attendance`):**
   - Interactive matrix table showing Monday through Sunday for any selected week.
   - Rows for both Individual Workers and Teams.
   - Quick keyboard-friendly status toggling: Present (Green chip), Half-Day (Yellow chip), Absent (Red chip).
   - Instant live updates to weekly wage subtotals.
3. **Labours & Teams Directory (`/(app)/labours`, `/(app)/teams`):**
   - Search bar with 350ms debounce.
   - Financial badges showing each worker's net balance (Green = owed to worker, Red = worker owes advance).
   - "Give Advance" button directly on cards/rows opening `PaymentModal`.
4. **Statements (`/(app)/statements`):**
   - Dynamic tabbed statement generator: Work Statement, Payment Statement, Combined Ledger.
   - Custom date-range pickers with presets (This Month, Last Month, Entire Season).
   - Print stylesheet optimized for clean A4 physical printing or PDF saving.

---

## 8. Mobile (Expo / React Native) Architecture

The mobile app in `/mobile` is optimized for field use under bright sunlight, with large touch targets ($\ge 48\text{dp}$), high contrast, and smooth gesture navigation.

### 8.1 Navigation Hierarchy
```
NavigationContainer
├── AuthStack (if unauthenticated)
│   └── LoginScreen
│
└── MainBottomTabs (if authenticated)
    ├── Tab 1: Home (DashboardScreen)
    ├── Tab 2: People (PeopleStack)
    │   ├── PeopleList (PeopleScreen - segmented tabs: Labours | Teams)
    │   ├── LabourDetailScreen
    │   └── TeamDetailScreen
    ├── Tab 3: Attendance (AttendanceScreen - full roll call)
    ├── Tab 4: Operations (OperationsStack)
    │   ├── OperationsList (OperationsScreen)
    │   └── OperationDetailScreen
    └── Tab 5: More (MoreStack)
        ├── MoreHome (MoreScreen)
        ├── PaymentsScreen
        ├── ContractsScreen
        ├── ContractDetailScreen
        ├── StatementsListScreen
        ├── StatementDetailScreen
        ├── PlotsScreen
        └── SettingsScreen
```

### 8.2 Mobile-Specific Native Integrations
- **Session Persistence:** `expo-secure-store` encrypts and stores the JWT session token, with `@react-native-async-storage/async-storage` for offline preferences.
- **Camera & Photos:** `expo-image-picker` allows snapping photos directly in the field for plot operations.
- **Offline & Print/Share:** `expo-print` generates native PDF statement receipts on the device, while `expo-sharing` triggers native Android/iOS share sheets (e.g. sharing PDF receipts directly via WhatsApp).
- **Safe Area Insets:** Strict use of `react-native-safe-area-context` to avoid notch and navigation bar overlap.

---

## 9. Multi-Language Localization (i18n) Architecture

LabourBook uses a centralized JSON/TS key-value localization structure across both Web and Mobile.

### 9.1 Supported Languages
- `en`: English (Default)
- `hi`: हिन्दी (Hindi)
- `mr`: मराठी (Marathi)

### 9.2 Key Namespaces
- `common`: Generic verbs (Save, Cancel, Delete, Edit, Search, Filter, Confirm).
- `sidebar`: Navigation labels.
- `dashboard`: Stat titles, greeting messages, roll call progress.
- `labours`: Worker fields (Daily wage, hometown, Aadhaar, active status).
- `teams`: Group fields (Member count, car rent, manager fee).
- `attendance`: Roll call statuses (Present, Absent, Half Day), task notes.
- `contracts`: Contract creation, per-acre terms, completion states.
- `payments`: Advance recording, payment methods (Cash, UPI, Bank).
- `statements`: Ledger columns, total earned, balance summary.
- `operations`: Farm operation types (Irrigation, Fertilizer, Spraying, Harvest).
- `plots`: Acreage, field names, variety.
- `settings`: Language toggles, profile fields.

**Fallback Rule:** If any translation key is missing in `hi` or `mr`, the `translate(locale, key)` function automatically falls back to `en`.

---

## 10. Development, Environment & Operational Guidelines

### 10.1 Environment Variables

#### Backend (`backend/.env`)
```env
APP_ENV=development
SECRET_KEY=your-super-secret-jwt-key
ACCESS_TOKEN_EXPIRE_MINUTES=43200     # 30 days
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/labourbook
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
SUPABASE_BUCKET_NAME=operation-photos
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

#### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

#### Mobile (`mobile/.env`)
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000  # Local LAN IP for Expo Go / Emulator
```

### 10.2 Starting Development Servers
Use the root launcher script `start-dev.bat`, or start services manually in separate terminals:

```powershell
# 1. Backend (FastAPI on http://localhost:8000)
cd backend
.venv\Scripts\activate
python run.py

# 2. Frontend (Next.js on http://localhost:3000)
cd frontend
npm run dev

# 3. Mobile (Expo Metro Bundler on http://localhost:8081)
cd mobile
npx expo start
```

### 10.3 Database Migrations with Alembic
Whenever modifying models in `backend/app/models/`:
```powershell
cd backend
.venv\Scripts\activate
alembic revision --autogenerate -m "describe_changes"
alembic upgrade head
```

---

## 11. Instructions & Rules for AI Agents Working on This Codebase

When extending, refactoring, or adding features to LabourBook, follow these non-negotiable rules:

1. **Strict Multi-Tenancy:**
   - Every database query in backend routers **must** filter by `owner_id == current_user.id`.
   - Never expose an endpoint that updates or deletes records without verifying ownership.
2. **Financial Precision:**
   - Always store currency/wages in the database as `Numeric(10, 2)` or `Numeric(12, 2)`.
   - In frontend/mobile calculations, avoid floating-point drift: round to 2 decimal places using `Math.round(val * 100) / 100` or format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
3. **Preserve Both Individual & Team Semantics:**
   - Attendances, payments, and contracts can target **either** an individual labourer or a team.
   - Always ensure XOR validation: either `labour_id` is set OR `team_id` is set.
4. **UI Design Fidelity:**
   - Maintain the established Material Design 3 palette (`#012d1d`, `#1b4332`, `#c1ecd4`, `#510900`, `#fcf9f8`).
   - Do not introduce ad-hoc bright blues or unstyled raw HTML inputs. Use predefined components (`DatePicker`, `TimePicker`, `Select`, `PaymentModal`).
5. **Multi-Language Integrity:**
   - Never hardcode English text in UI components. Always register new strings in `frontend/lib/i18n/` and `mobile/lib/i18n.ts` under appropriate namespaces for `en`, `hi`, and `mr`.
6. **Expo Mobile Rules:**
   - Never create or edit `ios/` or `android/` folders directly; use Continuous Native Generation (CNG) via `app.json`.
   - Install packages with `npx expo install <package>` to maintain SDK compatibility.
   - Verify changes with `npx tsc --noEmit` and `npx expo lint`.
7. **Windows Async Event Loop:**
   - On Windows, `psycopg` requires `WindowsSelectorEventLoopPolicy`. This is configured in `backend/main.py`. Do not remove it.
