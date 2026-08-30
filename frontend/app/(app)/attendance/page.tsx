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

export default function AttendancePage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch more per page since we filter present-only client-side
      const params: Record<string, string> = {
        page: String(page),
        page_size: "60",
      };
      if (filter !== "all") params.entity_type = filter;
      const qs = new URLSearchParams(params).toString();
      const result = await apiGet<HistoryResponse>(`/api/v1/attendance/history?${qs}`);
      setData(result);
    } catch {
      setError("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // Filter to present-only, then group by date
  const presentItems = (data?.items ?? []).filter(
    (r) => r.status === "present" || r.status === "half_day"
  );

  // Group by date (order preserved — backend returns newest first)
  const byDate: Map<string, AttendanceHistoryItem[]> = new Map();
  for (const item of presentItems) {
    const d = item.date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(item);
  }
  const dateGroups = Array.from(byDate.entries()); // [date, items[]]

  const filterButtons: { key: FilterType; label: string; icon: string }[] = [
    { key: "all", label: "All", icon: "format_list_bulleted" },
    { key: "labour", label: "Labourers", icon: "person" },
    { key: "team", label: "Teams", icon: "groups" },
  ];

  return (
    <>
      <title>Attendance | LabourBook</title>

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            ATTENDANCE
          </p>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", fontSize: "clamp(24px, 5vw, 32px)" }}>
            Attendance History
          </h1>
          <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            All days with present labourers or teams.
          </p>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-6">
          {/* Filter chips */}
          <div className="flex items-center gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className="h-9 px-4 rounded-full text-body-md font-semibold flex items-center gap-2 transition-all"
                style={{
                  backgroundColor:
                    filter === btn.key ? "var(--color-primary)" : "var(--color-surface-container-low)",
                  color:
                    filter === btn.key ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                  border: filter === btn.key ? "none" : "1px solid var(--color-outline-variant)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{btn.icon}</span>
                {btn.label}
              </button>
            ))}
            {!loading && data && (
              <span className="ml-auto text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                {presentItems.length} present records
              </span>
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

          {/* Grouped by date */}
          {!loading && !error && data && (
            <>
              {dateGroups.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <span className="material-symbols-outlined" style={{ fontSize: "56px", color: "var(--color-outline)" }}>
                    event_busy
                  </span>
                  <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>No records found</p>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    No present attendance has been recorded yet.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {dateGroups.map(([dateStr, items]) => {
                    const dayTotal = items.reduce((s, r) => s + (r.wage_earned ?? 0), 0);

                    return (
                      <div key={dateStr}>
                        {/* Date header */}
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}>
                              calendar_today
                            </span>
                            <p className="text-label-caps font-bold" style={{ color: "var(--color-on-surface)" }}>
                              {formatDateHeading(dateStr)}
                            </p>
                            <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                              · {new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-outline-variant)" }} />
                          <p className="text-label-caps font-semibold" style={{ color: "var(--color-primary)" }}>
                            {formatCurrency(dayTotal)}
                          </p>
                        </div>

                        {/* Rows for this date */}
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
                              <div
                                key={item.id}
                                className="grid items-center px-5 py-3"
                                style={{
                                  gridTemplateColumns: "minmax(120px,1.5fr) 70px minmax(80px,1fr) 60px 80px",
                                  borderBottom: isLast ? "none" : "1px solid var(--color-outline-variant)",
                                  backgroundColor: isTeam ? "rgba(232,213,247,0.05)" : "transparent",
                                  minWidth: "420px",
                                }}
                              >
                                {/* Name */}
                                <div className="flex items-center gap-2 min-w-0">
                                  {isTeam ? (
                                    <span className="material-symbols-outlined flex-shrink-0"
                                      style={{ fontSize: "16px", color: "#6b21a8" }}>groups</span>
                                  ) : (
                                    <span className="material-symbols-outlined flex-shrink-0"
                                      style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}>person</span>
                                  )}
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
                          </div> {/* end overflow */}
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
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    Page {data.page}
                  </p>
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
