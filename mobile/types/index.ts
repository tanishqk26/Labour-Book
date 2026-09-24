/**
 * LabourBook Mobile — Shared TypeScript Types
 * Mirrors frontend/types/index.ts
 */

export type AttendanceStatus = "present" | "absent" | "half_day";
export type PaymentMode = "cash" | "online" | "upi" | "bank_transfer";
export type EntityType = "individual" | "team";
export type ContractStatus = "active" | "completed" | "cancelled";
export type LabourStatus = "active" | "inactive";

export interface Labour {
  id: string;
  name: string;
  hometown?: string;
  phone?: string;
  aadhaar?: string;
  daily_wage: number;
  work_start_time?: string;
  work_end_time?: string;
  is_active: boolean;
  status: LabourStatus;
  created_at: string;
  updated_at: string;
}

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

export interface Team extends TeamSummary {
  members: Labour[];
}

export interface AttendanceRecord {
  id: string;
  date: string;
  labour_id?: string;
  team_id?: string;
  entity_type: EntityType;
  status: AttendanceStatus;
  task?: string;
  hours_worked?: number;
  wage_earned: number;
}

export interface Plot {
  id: string;
  name: string;
  area?: number;
  area_unit?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlotOperation {
  id: string;
  plot_id: string;
  lifecycle_id?: string;
  operation_date: string;
  operation_type: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentRead {
  id: string;
  labour_id?: string | null;
  team_id?: string | null;
  entity_name?: string | null;
  entity_type: string;
  date: string;
  amount: number;
  method: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface EntityPaymentSummary {
  entity_id: string;
  entity_type: string;
  entity_name: string;
  total_earned: number;
  total_paid: number;
  pending: number;
  payment_status: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture_url: string | null;
}
