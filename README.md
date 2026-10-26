# LabourBook (AgroLedger) 🍇

> Modern Farm Labour, Field Operations & Financial Management System for Grape Orchards and Agricultural Enterprises.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20Async-009688?style=flat&logo=fastapi)](file:///d:/Dev/Labour%20Book/backend)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016%20App%20Router-black?style=flat&logo=next.js)](file:///d:/Dev/Labour%20Book/frontend)
[![Expo](https://img.shields.io/badge/Mobile-Expo%20SDK%2058%20%2F%20React%20Native-000020?style=flat&logo=expo)](file:///d:/Dev/Labour%20Book/mobile)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat&logo=postgresql)](file:///d:/Dev/Labour%20Book/backend/alembic)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?style=flat&logo=tailwind-css)](file:///d:/Dev/Labour%20Book/frontend/app/globals.css)

---

## 📖 Complete Technical Documentation

- **Master Specification & Architecture:** [PROJECT_CONTEXT.md](file:///d:/Dev/Labour%20Book/PROJECT_CONTEXT.md)
- **AI Agent Guidelines:** [AGENTS.md](file:///d:/Dev/Labour%20Book/AGENTS.md)

---

## 🌟 Key Features

1. **Daily Roll Call & Weekly Attendance Sheet:**
   - Fast roll call for individual labourers and external teams.
   - Excel-style weekly matrix sheet with keyboard support and instant wage calculation.
   - Automatic wage breakdown: Full Day, Half Day, Absent, or Contract Assignment.

2. **Team & Mukadam Management:**
   - Supports team structures with custom rate formulas: `(Headcount × Daily Rate) + Fixed Car/Vehicle Rent + Manager Commission Fee`.

3. **Cash Advances & Financial Ledgers:**
   - Track every cash or UPI advance given to workers and teams.
   - Real-time balance calculations: Total Earned vs. Total Borrowed/Paid.
   - Comprehensive Work Statements, Payment Statements, and Combined Ledgers with printable PDF export.

4. **Grape Orchard Operations & Season Tracking:**
   - Annual Grape Farm Year tracking (April 1 to March 31).
   - Automated dual-lifecycle stages: **Vegetative / Shoot Development** (April pruning) and **Fruit Production / Harvest** (October pruning).
   - Daily plot operation logs (spraying, fertilizer, irrigation, canopy management) with photo proof and assigned worker hours.

5. **Multi-Language Support (i18n):**
   - Full localization in **English (`en`)**, **Hindi (`hi`)**, and **Marathi (`mr`)**.

6. **Cross-Platform:**
   - Responsive Web application optimized for desktop and tablets.
   - Native mobile application for Android and iOS (Expo / React Native) with offline-ready token storage, native camera, and PDF sharing via WhatsApp.

---

## 🚀 Quick Start

### 1-Click Launch (Windows)
Double-click [`start-dev.bat`](file:///d:/Dev/Labour%20Book/start-dev.bat) in the repository root to start all 3 services concurrently.

### Manual Launch

#### 1. Backend (FastAPI)
```powershell
cd backend
.venv\Scripts\activate
python run.py
```
- API Endpoint: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`

#### 2. Frontend (Next.js)
```powershell
cd frontend
npm run dev
```
- Web Application: `http://localhost:3000`

#### 3. Mobile (Expo Go / Emulator)
```powershell
cd mobile
npx expo start
```
- Metro Bundler: `http://localhost:8081`

---

## 📐 Project Structure

```
Labour Book/
├── backend/          # FastAPI Python backend (SQLAlchemy async, Alembic migrations)
├── frontend/         # Next.js 16 Web application (Tailwind v4, React 19)
├── mobile/           # Expo React Native mobile application (Android & iOS)
├── Build resources/  # UI designs, Stitch screen exports & requirements PDF
├── start-dev.bat     # Concurrently starts Backend, Web, and Expo servers
├── PROJECT_CONTEXT.md# Comprehensive project technical context
├── AGENTS.md         # AI Agent operational guidelines
└── README.md         # Project overview
```
