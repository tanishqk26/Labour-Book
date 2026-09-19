/**
 * LabourBook — Shared TypeScript Types & Interfaces
 *
 * Core domain types will be defined here as features are built.
 * Keep types lean and close to the API response shapes.
 */

// -------------------------------------------------------------------------
// Common
// -------------------------------------------------------------------------

export type AttendanceStatus = "present" | "absent" | "half_day";

export type PaymentMode = "cash" | "online" | "upi" | "bank_transfer";

export type EntityType = "individual" | "team";

export type ContractStatus = "active" | "completed" | "cancelled";

export type LabourStatus = "active" | "inactive";

// -------------------------------------------------------------------------
// Placeholder interfaces (filled out when building features)
// -------------------------------------------------------------------------

/** Individual farm labourer */
export interface Labour {
  id: string;
  name: string;
  hometown?: string;
  phone?: string;
  aadhaar?: string;
  daily_wage: number;
  work_start_time?: string;   // "08:00"
  work_end_time?: string;     // "17:00"
  is_active: boolean;
  status: LabourStatus;
  created_at: string;
  updated_at: string;
}

/** Labour team summary (used in list views — no members array) */
export interface TeamSummary {
  id: string;
  name: string;
  description?: string;
  hometown?: string;
  daily_wage: number;
  car_rent: number;
  manager_fee: number;
  is_active: boolean;
  status: LabourStatus;
  member_count: number;
  created_at: string;
  updated_at: string;
}

/** Labour team detail (includes members) */
export interface Team extends TeamSummary {
  members: Labour[];
}

/** Request to create a team */
export interface TeamCreate {
  name: string;
  description?: string;
  hometown?: string;
  daily_wage: number;
  car_rent?: number;
  manager_fee?: number;
}

/** Request to update a team */
export interface TeamUpdate {
  name?: string;
  description?: string;
  hometown?: string;
  daily_wage?: number;
  car_rent?: number;
  manager_fee?: number;
  is_active?: boolean;
}

/** Request to add/remove members */
export interface TeamMemberPayload {
  labour_ids: string[];
}

/** A single attendance record */
export interface AttendanceRecord {
  id: string;
  date: string;               // ISO date "2026-08-15"
  labour_id?: string;
  team_id?: string;
  entity_type: EntityType;
  status: AttendanceStatus;
  task?: string;
  hours_worked?: number;
  wage_earned: number;
}

/** A contract (fixed-price job) */
export interface Contract {
  id: string;
  title: string;
  entity_type: EntityType;
  labour_id?: string;
  team_id?: string;
  amount: number;
  status: ContractStatus;
  assigned_date: string;
  completed_date?: string;
  notes?: string;
}

/** A payment/advance given to a labour or team */
export interface Payment {
  id: string;
  date: string;
  entity_type: EntityType;
  labour_id?: string;
  team_id?: string;
  amount: number;
  reason?: string;
  mode: PaymentMode;
  notes?: string;
}

/** Payment as returned from the API (PaymentRead schema) */
export interface PaymentRead {
  id: string;
  labour_id?: string | null;
  team_id?: string | null;
  entity_name?: string | null;
  entity_type: string; // "individual" | "team"
  date: string;
  amount: number;
  method: string; // "cash" | "upi" | "bank_transfer" | "other"
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Financial summary for a single labour or team */
export interface EntityPaymentSummary {
  entity_id: string;
  entity_type: string; // "individual" | "team"
  entity_name: string;
  total_earned: number;
  total_paid: number;
  pending: number;
  payment_status: string; // "paid" | "partially_paid" | "pending"
}

/** Overall payments summary across all entities */
export interface PaymentsSummary {
  total_earned: number;
  total_paid: number;
  total_pending: number;
  paid_this_month: number;
}

/** Paginated payments list */
export interface PaginatedPayments {
  items: PaymentRead[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** Financial summary for a labour or team */
export interface FinancialSummary {
  entity_type: EntityType;
  entity_id: string;
  entity_name: string;
  total_earned: number;
  total_advances: number;
  total_paid: number;
  outstanding: number;
}

// -------------------------------------------------------------------------
// API Response wrappers
// -------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ApiHealthResponse {
  status: "ok" | "error";
  database: "connected" | "unreachable";
  db_error?: string;
}
