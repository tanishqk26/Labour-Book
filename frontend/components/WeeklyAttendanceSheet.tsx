"use client";

import type { CSSProperties } from "react";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

export type AttStatus = "present" | "absent" | "half_day";

export interface SheetEntity {
  key: string;
  id: string;
  kind: "labour" | "team";
  name: string;
  memberCount?: number;
}

export interface SheetAtt {
  id: string;
  date: string;
  labour_id: string | null;
  team_id: string | null;
  status: AttStatus;
  labour?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
}

export interface SheetPayment {
  amount: number;
  labour_id: string | null;
  team_id: string | null;
  date: string;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toISODate(d);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return (
    s.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " – " +
    e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  );
}

const DAY_LETTERS = ["M", "T", "W", "Th", "F", "S", "S"];

function statusMark(status: AttStatus | null) {
  if (status === "present") return { text: "✓", color: "#14532d", bg: "#86efac", border: "2px solid #166534" };
  if (status === "absent") return { text: "×", color: "#7f1d1d", bg: "#fca5a5", border: "2px solid #991b1b" };
  if (status === "half_day") return { text: "H", color: "#78350f", bg: "#fcd34d", border: "2px solid #b45309" };
  return { text: "", color: "var(--color-primary)", bg: "var(--color-surface-container-lowest)", border: "2px solid var(--color-primary)" };
}

function daysValue(status: AttStatus | null): number {
  if (status === "present") return 1;
  if (status === "half_day") return 0.5;
  return 0;
}

interface Props {
  weekStart: string;
  entities: SheetEntity[];
  records: SheetAtt[];
  payments: SheetPayment[];
  interactive?: boolean;
  savingKey?: string | null;
  onCellClick?: (entity: SheetEntity, date: string, current: SheetAtt | null) => void;
  onRemove?: (entity: SheetEntity) => void;
}

export default function WeeklyAttendanceSheet({
  weekStart,
  entities,
  records,
  payments,
  interactive = false,
  savingKey,
  onCellClick,
  onRemove,
}: Props) {
  const { t } = useLanguage();
  const dates = weekDates(weekStart);
  const today = toISODate(new Date());

  function recFor(entity: SheetEntity, date: string): SheetAtt | null {
    return (
      records.find((r) => r.date === date && (entity.kind === "labour" ? r.labour_id === entity.id : r.team_id === entity.id)) ??
      null
    );
  }

  function paidFor(entity: SheetEntity): number {
    return payments
      .filter((p) => (entity.kind === "labour" ? p.labour_id === entity.id : p.team_id === entity.id))
      .reduce((s, p) => s + p.amount, 0);
  }

  const th: CSSProperties = {
    color: "var(--color-on-surface-variant)",
    borderBottom: "1px solid var(--color-outline-variant)",
    backgroundColor: "var(--color-surface-container-low)",
  };
  const td: CSSProperties = {
    borderBottom: "1px solid var(--color-outline-variant)",
    color: "var(--color-on-surface)",
  };

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-2">
        <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--color-outline)" }}>groups</span>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          {t(interactive ? "attendance.emptyMarkList" : "attendance.emptySheet")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
      <table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr>
            <th className="px-3 py-2 text-label-caps font-semibold sticky left-0 z-10 min-w-[140px]" style={{ ...th, backgroundColor: "var(--color-surface-container-low)" }}>
              {t("common.name")}
            </th>
            {dates.map((d, i) => {
              const dayNum = new Date(d + "T00:00:00").getDate();
              const isToday = d === today;
              return (
                <th key={d} className="px-1 py-2 text-center font-semibold w-14" style={th}>
                  <div className="text-label-caps" style={{ color: isToday ? "var(--color-primary)" : "var(--color-on-surface-variant)" }}>{DAY_LETTERS[i]}</div>
                  <div className="text-body-md" style={{ color: isToday ? "var(--color-primary)" : "var(--color-on-surface)" }}>{dayNum}</div>
                </th>
              );
            })}
            <th className="px-3 py-2 text-label-caps font-semibold whitespace-nowrap text-right" style={th}>
              {t("attendance.totalDays")}
            </th>
            <th className="px-3 py-2 text-label-caps font-semibold whitespace-nowrap text-right" style={th}>
              {t("attendance.paymentPaid")}
            </th>
            {onRemove && (
              <th className="px-2 py-2 w-10" style={th} />
            )}
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => {
            const statuses = dates.map((d) => recFor(entity, d));
            const totalDays = statuses.reduce((s, r) => s + daysValue(r?.status ?? null), 0);
            const paid = paidFor(entity);
            return (
              <tr key={entity.key}>
                <td className="px-3 py-2 text-body-md font-semibold sticky left-0 z-10 whitespace-nowrap" style={{ ...td, backgroundColor: "var(--color-surface-container-lowest)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: entity.kind === "team" ? "#6b21a8" : "var(--color-on-surface-variant)" }}>
                      {entity.kind === "team" ? "groups" : "person"}
                    </span>
                    {entity.name}
                  </span>
                </td>
                {dates.map((d, i) => {
                  const rec = statuses[i];
                  const mark = statusMark(rec?.status ?? null);
                  const future = d > today;
                  const key = `${entity.key}:${d}`;
                  const clickable = interactive && !future && onCellClick;
                  return (
                    <td key={d} className="px-1 py-1 text-center" style={td}>
                      <button
                        type="button"
                        disabled={!clickable || savingKey === key}
                        onClick={() => clickable && onCellClick(entity, d, rec)}
                        className="w-10 h-10 rounded-full text-body-lg font-extrabold mx-auto flex items-center justify-center disabled:opacity-40"
                        style={{
                          backgroundColor: mark.bg,
                          color: mark.color,
                          cursor: clickable ? "pointer" : "default",
                          border: mark.border,
                          boxShadow: rec ? "none" : "inset 0 0 0 1px rgba(0,0,0,0.06)",
                        }}
                        aria-label={`${entity.name} ${d}`}
                      >
                        {savingKey === key ? "…" : mark.text}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-body-md font-semibold text-right whitespace-nowrap" style={td}>
                  {totalDays % 1 === 0 ? totalDays.toFixed(0) : totalDays.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-body-md font-semibold text-right whitespace-nowrap" style={td}>
                  {paid > 0 ? formatCurrency(paid) : "—"}
                </td>
                {onRemove && (
                  <td className="px-2 py-2 text-center" style={td}>
                    <button
                      type="button"
                      onClick={() => onRemove(entity)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ color: "var(--color-error)", border: "1px solid var(--color-outline-variant)" }}
                      aria-label={t("attendance.removeFromListAria")}
                      title={t("attendance.removeFromListAria")}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>person_remove</span>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
