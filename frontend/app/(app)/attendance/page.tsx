"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import DatePicker from "@/components/ui/DatePicker";
import { useLanguage } from "@/context/LanguageContext";

interface AttendanceHistoryItem {
  id: string;
  date: string;
  labour_id: string | null;
  team_id: string | null;
  status: string;
  task: string | null;
  hours_worked: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  wage_earned: number;
  num_labourers: number | null;
  wage_type: string;
  contract: { id: string; title: string } | null;
  labour?: { id: string; name: string };
  team?: { id: string; name: string };
}

interface PaymentItem {
  id: string;
  date: string;
  amount: number;
  method: string;
  notes: string | null;
  entity_name: string | null;
  labour_id: string | null;
  team_id: string | null;
}

interface HistoryResponse {
  items: AttendanceHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

type FilterType = "all" | "labour" | "team";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return (
    s.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " – " +
    e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  );
}

function formatDayLabel(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const yesterday = new Date(todayStr + "T00:00:00");
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = (dt: Date) =>
    dt.getFullYear() * 10000 + dt.getMonth() * 100 + dt.getDate();
  const v = fmt(d);

  if (v === fmt(today)) return "Today";
  if (v === fmt(yesterday)) return "Yesterday";

  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// Styled date input
function DateInput({
  id, value, onChange, max, min, label,
}: {
  id: string; value: string; onChange: (v: string) => void;
  max?: string; min?: string; label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-label-caps"
          style={{ color: "var(--color-on-surface-variant)" }}>
          {label}
        </label>
      )}
      <DatePicker id={id} value={value} onChange={onChange} max={max} min={min} className="w-full" />
    </div>
  );
}

export default function AttendancePage() {
  const { t } = useLanguage();
  const today = todayISO();

  const [entityFilter, setEntityFilter] = useState<FilterType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<AttendanceHistoryItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: "1", page_size: "100" };
      if (entityFilter !== "all") params.entity_type = entityFilter;
      const qs = new URLSearchParams(params).toString();
      const [attResult, pmtResult] = await Promise.all([
        apiGet<HistoryResponse>(`/api/v1/attendance/history?${qs}`),
        apiGet<{ items: PaymentItem[] }>("/api/v1/payments?page_size=100"),
      ]);
      setData(attResult.items);
      setPayments(pmtResult.items);
    } catch {
      setError(t("attendance.loadErrorHistory"));
    } finally {
      setLoading(false);
    }
  }, [entityFilter, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side date filter
  const filtered = data.filter((r) => {
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });

  // Group by week
  const weekMap = new Map<string, AttendanceHistoryItem[]>();
  for (const r of filtered) {
    const ws = getWeekStart(r.date);
    if (!weekMap.has(ws)) weekMap.set(ws, []);
    weekMap.get(ws)!.push(r);
  }
  const weeks = [...weekMap.keys()].sort((a, b) => b.localeCompare(a));

  // Group payments by week
  const pmtByWeek = new Map<string, PaymentItem[]>();
  for (const p of payments) {
    const ws = getWeekStart(p.date);
    if (!pmtByWeek.has(ws)) pmtByWeek.set(ws, []);
    pmtByWeek.get(ws)!.push(p);
  }

  const entityFilterButtons: { key: FilterType; label: string; icon: string }[] = [
    { key: "all", label: t("common.all"), icon: "format_list_bulleted" },
    { key: "labour", label: t("attendance.labourersFilter"), icon: "person" },
    { key: "team", label: t("attendance.teamsFilter"), icon: "groups" },
  ];

  return (
    <>
      <title>{`${t("attendance.pageTitle")} | LabourBook`}</title>
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>

        {/* Header */}
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            {t("attendance.eyebrow")}
          </p>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)" }}>
            {t("attendance.historyTitle")}
          </h1>
          <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            {t("attendance.historySubtitle")}
          </p>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-5">

          {/* ── Filter bar ── */}
          <div className="rounded-2xl p-4 flex flex-col gap-4"
            style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>

            {/* Entity chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-caps mr-1" style={{ color: "var(--color-on-surface-variant)" }}>
                {t("attendance.show")}
              </span>
              {entityFilterButtons.map((btn) => (
                <button key={btn.key} onClick={() => setEntityFilter(btn.key)}
                  className="h-8 px-3 rounded-full text-body-md font-semibold flex items-center gap-1.5 transition-all"
                  style={{
                    backgroundColor: entityFilter === btn.key ? "var(--color-primary)" : "var(--color-surface-container-low)",
                    color: entityFilter === btn.key ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    border: entityFilter === btn.key ? "none" : "1px solid var(--color-outline-variant)",
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-end gap-3 flex-wrap">
              <DateInput id="date-from" value={dateFrom} onChange={(v) => { setDateFrom(v); if (dateTo && v > dateTo) setDateTo(""); }}
                max={dateTo || today} label={t("common.from")} />
              <span className="text-body-md mb-2.5" style={{ color: "var(--color-on-surface-variant)" }}>→</span>
              <DateInput id="date-to" value={dateTo} onChange={setDateTo} min={dateFrom} max={today} label={t("common.to")} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="h-10 px-3 rounded-lg text-label-caps flex items-center gap-1 mb-0"
                  style={{ color: "var(--color-on-surface-variant)", border: "1px solid var(--color-outline-variant)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                  {t("common.clear")}
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="py-6 px-5 rounded-xl text-center"
              style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={fetchData} className="px-5 py-2 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}>
                {t("attendance.tryAgain")}
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }} />
            </div>
          )}

          {/* ── Weekly catalogue ── */}
          {!loading && !error && (
            <>
              {weeks.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <span className="material-symbols-outlined" style={{ fontSize: "56px", color: "var(--color-outline)" }}>event_busy</span>
                  <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{t("attendance.noRecordsFound")}</p>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    {dateFrom || dateTo ? t("attendance.noPresentForSelectedDate") : t("attendance.noPresentRecorded")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {weeks.map((weekStart) => {
                    const weekRecs = weekMap.get(weekStart)!;
                    const weekEnd = (() => {
                      const d = new Date(weekStart + "T00:00:00");
                      d.setDate(d.getDate() + 6);
                      return d.toISOString().slice(0, 10);
                    })();
                    const weekPmts = pmtByWeek.get(weekStart) ?? [];

                    // Group by date within week (sort ascending = Mon→Sun)
                    const dateMap = new Map<string, AttendanceHistoryItem[]>();
                    for (const r of weekRecs) {
                      if (!dateMap.has(r.date)) dateMap.set(r.date, []);
                      dateMap.get(r.date)!.push(r);
                    }
                    const dates = [...dateMap.keys()].sort((a, b) => a.localeCompare(b));

                    const presentCount = weekRecs.filter(r => r.status === "present" || r.status === "half_day").length;
                    const totalEarned = weekRecs.reduce((s, r) => s + (r.wage_earned ?? 0), 0);
                    const totalPaid = weekPmts.reduce((s, p) => s + p.amount, 0);

                    return (
                      <div key={weekStart} className="rounded-2xl overflow-hidden"
                        style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>

                        {/* Week header */}
                        <div className="px-5 py-3 flex items-center justify-between gap-2 flex-wrap"
                          style={{ backgroundColor: "var(--color-surface-container-low)", borderBottom: "1px solid var(--color-outline-variant)" }}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-primary)" }}>calendar_month</span>
                            <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                              {formatWeekRange(weekStart, weekEnd)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined" style={{ fontSize: "13px", color: "#2d7a4f" }}>check_circle</span>
                              <span className="text-label-caps font-semibold" style={{ color: "#2d7a4f" }}>
                                {presentCount} / {weekRecs.length} present
                              </span>
                            </div>
                            {totalEarned > 0 && (
                              <span className="text-label-caps font-semibold" style={{ color: "var(--color-primary)" }}>
                                {formatCurrency(totalEarned)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Day sections */}
                        {dates.map((dateStr, di) => {
                          const dayRecs = dateMap.get(dateStr)!;
                          const dayPmts = payments.filter(p => p.date === dateStr);
                          const dayEarned = dayRecs.reduce((s, r) => s + (r.wage_earned ?? 0), 0);

                          return (
                            <div key={dateStr}>
                              {/* Day header */}
                              <div className="px-5 py-2 flex items-center justify-between gap-3 flex-wrap"
                                style={{
                                  backgroundColor: "var(--color-surface-container)",
                                  borderTop: di > 0 ? "2px solid var(--color-outline-variant)" : "1px solid var(--color-outline-variant)",
                                }}>
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--color-on-surface-variant)" }}>calendar_today</span>
                                  <p className="text-label-caps font-bold" style={{ color: "var(--color-on-surface)" }}>
                                    {formatDayLabel(dateStr, today)}
                                  </p>
                                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                                    · {new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  {dayEarned > 0 && (
                                    <span className="text-label-caps font-semibold" style={{ color: "var(--color-primary)" }}>
                                      {formatCurrency(dayEarned)}
                                    </span>
                                  )}
                                  {dayPmts.map(p => (
                                    <span key={p.id} className="px-2 py-0.5 rounded-full text-label-caps flex items-center gap-1"
                                      style={{ backgroundColor: "#dcfce7", color: "#166534" }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>payments</span>
                                      {p.entity_name ? `${p.entity_name} · ` : ""}{formatCurrency(p.amount)}{p.method !== "cash" ? ` (${p.method.replace("_", " ")})` : ""}{p.notes ? ` · ${p.notes}` : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Table header row */}
                              <div className="grid px-5 py-2"
                                style={{
                                  gridTemplateColumns: "minmax(130px,1.5fr) 70px minmax(80px,1fr) 55px 90px",
                                  borderBottom: "1px solid var(--color-outline-variant)",
                                  backgroundColor: "var(--color-surface-container-lowest)",
                                  minWidth: "420px",
                                }}>
                                {["Name", "Type", "Task", "Time", "Amount"].map(h => (
                                  <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{h}</p>
                                ))}
                              </div>

                              {/* Attendance rows */}
                              {dayRecs.map((item, ri) => {
                                const isTeam = !!item.team_id;
                                const entityName = isTeam
                                  ? (item.team?.name ?? t("attendance.teamFallbackName"))
                                  : (item.labour?.name ?? t("attendance.labourFallbackName"));
                                const isPresent = item.status === "present" || item.status === "half_day";
                                const isContract = item.wage_type === "contract";
                                const isLast = ri === dayRecs.length - 1;

                                return (
                                  <div key={item.id} className="grid items-center px-5 py-3"
                                    style={{
                                      gridTemplateColumns: "minmax(130px,1.5fr) 70px minmax(80px,1fr) 55px 90px",
                                      borderBottom: isLast ? "none" : "1px solid var(--color-outline-variant)",
                                      backgroundColor: isPresent ? "rgba(193,236,212,0.07)" : "transparent",
                                      minWidth: "420px",
                                    }}>

                                    {/* Name */}
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="material-symbols-outlined flex-shrink-0"
                                        style={{ fontSize: "15px", color: isTeam ? "#6b21a8" : "var(--color-on-surface-variant)" }}>
                                        {isTeam ? "groups" : "person"}
                                      </span>
                                      <p className="text-body-md font-medium truncate" style={{ color: "var(--color-on-surface)" }}>
                                        {entityName}
                                      </p>
                                    </div>

                                    {/* Type */}
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-label-caps" style={{ color: isTeam ? "#6b21a8" : "var(--color-on-surface-variant)" }}>
                                        {isTeam
                                          ? `${t("attendance.teamFallbackName")}${item.num_labourers ? ` · ${item.num_labourers}` : ""}`
                                          : (item.status === "half_day" ? t("attendance.halfDay") : t("attendance.labourFallbackName"))}
                                      </span>
                                      {/* Wage type badge */}
                                      <span className="px-1.5 py-0.5 rounded text-label-caps font-semibold w-fit"
                                        style={{
                                          backgroundColor: isContract ? "#fef9c3" : "var(--color-primary-fixed)",
                                          color: isContract ? "#92400e" : "var(--color-primary)",
                                          fontSize: "9px",
                                        }}>
                                        {isContract ? "CONTRACT" : "DAILY"}
                                      </span>
                                    </div>

                                    {/* Task */}
                                    <p className="text-body-md truncate pr-2" style={{ color: "var(--color-on-surface-variant)" }}>
                                      {item.task || "—"}
                                    </p>

                                    {/* Time */}
                                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                                      {item.hours_worked ? `${item.hours_worked}h` : "—"}
                                    </p>

                                    {/* Amount / Contract badge */}
                                    {isContract ? (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="px-1.5 py-0.5 rounded text-label-caps font-semibold w-fit"
                                          style={{ backgroundColor: "#fef9c3", color: "#92400e" }}>
                                          CONTRACT
                                        </span>
                                        {item.contract && (
                                          <p className="text-label-caps truncate max-w-[80px]" style={{ color: "#92400e" }}>
                                            {item.contract.title}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                                        {item.wage_earned > 0 ? formatCurrency(item.wage_earned) : "—"}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {/* ── Week summary footer ── */}
                        <div className="px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2"
                          style={{ borderTop: "2px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)" }}>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#2d7a4f" }}>check_circle</span>
                            <span className="text-label-caps font-semibold" style={{ color: "#2d7a4f" }}>
                              {presentCount} / {weekRecs.length} present
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--color-primary)" }}>work</span>
                            <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Earned:</span>
                            <span className="text-label-caps font-semibold" style={{ color: "var(--color-primary)" }}>
                              {formatCurrency(totalEarned)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="material-symbols-outlined" style={{ fontSize: "14px", color: totalPaid > 0 ? "#2d7a4f" : "var(--color-outline)" }}>payments</span>
                            <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Paid this week:</span>
                            <span className="text-label-caps font-semibold" style={{ color: totalPaid > 0 ? "#2d7a4f" : "var(--color-on-surface-variant)" }}>
                              {totalPaid > 0 ? formatCurrency(totalPaid) : "—"}
                            </span>
                            {weekPmts.map(p => (
                              <span key={p.id} className="px-2 py-0.5 rounded-full text-label-caps"
                                style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-on-surface-variant)" }}>
                                {p.entity_name ? `${p.entity_name} · ` : ""}{p.method.replace("_", " ")}{p.notes ? ` · ${p.notes}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
