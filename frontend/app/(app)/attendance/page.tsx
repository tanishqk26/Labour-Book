"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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
  labour?: { id: string; name: string };
  team?: { id: string; name: string };
}

interface HistoryResponse {
  items: AttendanceHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

type FilterType = "all" | "labour" | "team";
type DateMode = "all" | "single" | "range";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Styled date input that matches the app theme
function DateInput({
  id,
  value,
  onChange,
  max,
  min,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  max?: string;
  min?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-label-caps"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <span
          className="material-symbols-outlined absolute left-3 pointer-events-none"
          style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}
        >
          calendar_today
        </span>
        <input
          id={id}
          type="date"
          value={value}
          max={max}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pl-9 pr-3 rounded-lg text-body-md w-full"
          style={{
            backgroundColor: "var(--color-surface-container-low)",
            border: "1px solid var(--color-outline-variant)",
            color: value ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
            outline: "none",
            colorScheme: "dark",
          }}
        />
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [entityFilter, setEntityFilter] = useState<FilterType>("all");
  const [dateMode, setDateMode] = useState<DateMode>("all");
  const [singleDate, setSingleDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: "100",
      };
      if (entityFilter !== "all") params.entity_type = entityFilter;
      const qs = new URLSearchParams(params).toString();
      const result = await apiGet<HistoryResponse>(`/api/v1/attendance/history?${qs}`);
      setData(result);
    } catch {
      setError("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [entityFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityFilter, dateMode, singleDate, dateFrom, dateTo]);

  // Step 1: filter to present-only
  const presentItems = (data?.items ?? []).filter(
    (r) => r.status === "present" || r.status === "half_day"
  );

  // Step 2: apply date filter client-side
  const dateFilteredItems = presentItems.filter((r) => {
    if (dateMode === "single" && singleDate) return r.date === singleDate;
    if (dateMode === "range") {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
    }
    return true;
  });

  // Step 3: group by date (backend returns newest first)
  const byDate: Map<string, AttendanceHistoryItem[]> = new Map();
  for (const item of dateFilteredItems) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  }
  const dateGroups = Array.from(byDate.entries());

  const totalShown = dateFilteredItems.length;
  const grandTotal = dateFilteredItems.reduce((s, r) => s + (r.wage_earned ?? 0), 0);

  const entityFilterButtons: { key: FilterType; label: string; icon: string }[] = [
    { key: "all", label: "All", icon: "format_list_bulleted" },
    { key: "labour", label: "Labourers", icon: "person" },
    { key: "team", label: "Teams", icon: "groups" },
  ];

  const today = todayISO();

  return (
    <>
      <title>Attendance | LabourBook</title>
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>

        {/* Header */}
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            ATTENDANCE
          </p>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)" }}>
            Attendance History
          </h1>
          <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            All days with present labourers or teams.
          </p>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-5">

          {/* ── Filter bar ── */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-4"
            style={{
              backgroundColor: "var(--color-surface-container-lowest)",
              border: "1px solid var(--color-outline-variant)",
            }}
          >
            {/* Row 1: entity chips + record count */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-caps mr-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Show:
              </span>
              {entityFilterButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setEntityFilter(btn.key)}
                  className="h-8 px-3 rounded-full text-body-md font-semibold flex items-center gap-1.5 transition-all"
                  style={{
                    backgroundColor:
                      entityFilter === btn.key ? "var(--color-primary)" : "var(--color-surface-container-low)",
                    color:
                      entityFilter === btn.key ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    border: entityFilter === btn.key ? "none" : "1px solid var(--color-outline-variant)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
              {!loading && data && totalShown > 0 && (
                <span className="ml-auto text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  {totalShown} records · <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{formatCurrency(grandTotal)}</span>
                </span>
              )}
            </div>

            {/* Row 2: date mode selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-caps mr-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Date:
              </span>
              {(["all", "single", "range"] as DateMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDateMode(mode)}
                  className="h-8 px-3 rounded-full text-body-md font-semibold flex items-center gap-1.5 transition-all capitalize"
                  style={{
                    backgroundColor:
                      dateMode === mode ? "var(--color-secondary-container)" : "var(--color-surface-container-low)",
                    color:
                      dateMode === mode ? "var(--color-on-secondary-fixed)" : "var(--color-on-surface-variant)",
                    border: dateMode === mode ? "none" : "1px solid var(--color-outline-variant)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    {mode === "all" ? "event_note" : mode === "single" ? "calendar_today" : "date_range"}
                  </span>
                  {mode === "all" ? "All Time" : mode === "single" ? "Specific Date" : "Date Range"}
                </button>
              ))}
            </div>

            {/* Row 3: date picker(s) — only when mode is selected */}
            {dateMode === "single" && (
              <div className="flex items-end gap-3 flex-wrap">
                <DateInput
                  id="date-single"
                  value={singleDate}
                  onChange={setSingleDate}
                  max={today}
                  label="Select date"
                />
                {singleDate && (
                  <button
                    onClick={() => setSingleDate("")}
                    className="h-10 px-3 rounded-lg text-label-caps flex items-center gap-1"
                    style={{ color: "var(--color-on-surface-variant)", border: "1px solid var(--color-outline-variant)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                    Clear
                  </button>
                )}
              </div>
            )}

            {dateMode === "range" && (
              <div className="flex items-end gap-3 flex-wrap">
                <DateInput
                  id="date-from"
                  value={dateFrom}
                  onChange={(v) => {
                    setDateFrom(v);
                    if (dateTo && v > dateTo) setDateTo("");
                  }}
                  max={dateTo || today}
                  label="From"
                />
                <span className="text-body-md mb-2.5" style={{ color: "var(--color-on-surface-variant)" }}>→</span>
                <DateInput
                  id="date-to"
                  value={dateTo}
                  onChange={setDateTo}
                  min={dateFrom}
                  max={today}
                  label="To"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="h-10 px-3 rounded-lg text-label-caps flex items-center gap-1 mb-0"
                    style={{ color: "var(--color-on-surface-variant)", border: "1px solid var(--color-outline-variant)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="py-6 px-5 rounded-xl text-center"
              style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={fetchData} className="px-5 py-2 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}>
                Try Again
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

          {/* Grouped records */}
          {!loading && !error && data && (
            <>
              {dateGroups.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <span className="material-symbols-outlined" style={{ fontSize: "56px", color: "var(--color-outline)" }}>
                    event_busy
                  </span>
                  <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>No records found</p>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    {dateMode !== "all"
                      ? "No present attendance for the selected date(s)."
                      : "No present attendance has been recorded yet."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {dateGroups.map(([dateStr, items]) => {
                    const dayTotal = items.reduce((s, r) => s + (r.wage_earned ?? 0), 0);
                    return (
                      <div key={dateStr}>
                        {/* Date header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined"
                              style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}>
                              calendar_today
                            </span>
                            <p className="text-label-caps font-bold" style={{ color: "var(--color-on-surface)" }}>
                              {formatDateHeading(dateStr)}
                            </p>
                            <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                              · {new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", year: "numeric"
                              })}
                            </p>
                          </div>
                          <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-outline-variant)" }} />
                          <p className="text-label-caps font-semibold" style={{ color: "var(--color-primary)" }}>
                            {formatCurrency(dayTotal)}
                          </p>
                        </div>

                        {/* Records for this date */}
                        <div className="rounded-xl overflow-hidden"
                          style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
                          <div style={{ overflowX: "auto" }}>
                            {/* Table header */}
                            <div className="grid px-5 py-2.5"
                              style={{
                                gridTemplateColumns: "minmax(120px,1.5fr) 70px minmax(80px,1fr) 60px 80px",
                                borderBottom: "1px solid var(--color-outline-variant)",
                                backgroundColor: "var(--color-surface-container-low)",
                                minWidth: "420px",
                              }}>
                              {["Name", "Type", "Task", "Time", "Amount"].map((h) => (
                                <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{h}</p>
                              ))}
                            </div>

                            {items.map((item, idx) => {
                              const isTeam = !!item.team_id;
                              const entityName = isTeam
                                ? (item.team?.name ?? "Team")
                                : (item.labour?.name ?? "Labour");
                              const isLast = idx === items.length - 1;
                              return (
                                <div key={item.id} className="grid items-center px-5 py-3"
                                  style={{
                                    gridTemplateColumns: "minmax(120px,1.5fr) 70px minmax(80px,1fr) 60px 80px",
                                    borderBottom: isLast ? "none" : "1px solid var(--color-outline-variant)",
                                    backgroundColor: isTeam ? "rgba(232,213,247,0.05)" : "transparent",
                                    minWidth: "420px",
                                  }}>
                                  {/* Name */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="material-symbols-outlined flex-shrink-0"
                                      style={{ fontSize: "16px", color: isTeam ? "#6b21a8" : "var(--color-on-surface-variant)" }}>
                                      {isTeam ? "groups" : "person"}
                                    </span>
                                    <p className="text-body-md font-medium truncate" style={{ color: "var(--color-on-surface)" }}>
                                      {entityName}
                                    </p>
                                  </div>
                                  {/* Type */}
                                  <span className="text-label-caps" style={{ color: isTeam ? "#6b21a8" : "var(--color-on-surface-variant)" }}>
                                    {isTeam
                                      ? `Team${item.num_labourers ? ` · ${item.num_labourers}` : ""}`
                                      : (item.status === "half_day" ? "Half Day" : "Labour")}
                                  </span>
                                  {/* Task */}
                                  <p className="text-body-md truncate pr-2" style={{ color: "var(--color-on-surface-variant)" }}>
                                    {item.task || "—"}
                                  </p>
                                  {/* Time */}
                                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                                    {item.hours_worked ? `${item.hours_worked}h` : "—"}
                                  </p>
                                  {/* Amount */}
                                  <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                                    {item.wage_earned > 0 ? formatCurrency(item.wage_earned) : "—"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {(data.page > 1 || data.has_more) && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-1 disabled:opacity-40"
                    style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_left</span>
                    Prev
                  </button>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Page {data.page}</p>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data.has_more}
                    className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-1 disabled:opacity-40"
                    style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
                  >
                    Next
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
