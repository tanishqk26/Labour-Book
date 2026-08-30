"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { formatCurrency, getGreeting } from "@/lib/utils";

interface LabourAttendanceStatus {
  labour_id: string;
  labour_name: string;
  daily_wage: number;
  hometown: string | null;
  attendance_id: string | null;
  status: "present" | "absent" | "half_day" | null;
  task: string | null;
  hours_worked: number | null;
  wage_earned: number | null;
}

interface TeamAttendanceStatus {
  team_id: string;
  team_name: string;
  daily_wage: number;
  car_rent: number;
  manager_fee: number;
  attendance_id: string | null;
  status: "present" | "absent" | null;
  num_labourers: number | null;
  task: string | null;
  hours_worked: number | null;
  wage_earned: number | null;
}

interface DailyAttendanceView {
  labours: LabourAttendanceStatus[];
  teams: TeamAttendanceStatus[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  { bg: "#c1ecd4", color: "#012d1d" },
  { bg: "#d7e4f0", color: "#111d25" },
  { bg: "#fef3c7", color: "#6b4c04" },
  { bg: "#ffdad3", color: "#510900" },
  { bg: "#e8d5f7", color: "#3d1457" },
];

export default function DashboardPage() {
  const today = todayISO();
  const [labourRecords, setLabourRecords] = useState<LabourAttendanceStatus[]>([]);
  const [teamRecords, setTeamRecords] = useState<TeamAttendanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<DailyAttendanceView>(
        `/api/v1/attendance/daily?for_date=${today}`
      );
      setLabourRecords(data.labours);
      setTeamRecords(data.teams);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Derive stats
  const presentLabours = labourRecords.filter((r) => r.status === "present");
  const presentTeams = teamRecords.filter((r) => r.status === "present");
  const labourMarkedCount = labourRecords.filter((r) => r.status !== null).length;
  const teamMarkedCount = teamRecords.filter((r) => r.status !== null).length;
  const totalLabourWage = labourRecords.reduce((sum, r) => sum + (r.wage_earned ?? 0), 0);
  const totalTeamWage = teamRecords.reduce((sum, r) => sum + (r.wage_earned ?? 0), 0);
  const totalWage = totalLabourWage + totalTeamWage;
  const totalEntities = labourRecords.length + teamRecords.length;
  const totalMarked = labourMarkedCount + teamMarkedCount;
  const isAttendanceCompleted = totalEntities > 0 && totalMarked === totalEntities;

  const dateLabel = new Date()
    .toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <>
      <title>Dashboard | LabourBook</title>

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        {/* Page Header */}
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            {dateLabel}
          </p>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", fontSize: "clamp(24px, 5vw, 32px)" }}>
            {getGreeting()},{" "}
            <span style={{ color: "var(--color-primary)" }}>Farm Manager</span>
          </h1>
          <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Here&apos;s what happened on your farm today.
          </p>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-6">

          {/* Today's Summary card */}
          <div
            className="px-6 py-5 rounded-2xl"
            style={{
              backgroundColor: "var(--color-surface-container-low)",
              border: "1px solid var(--color-outline-variant)",
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                <span className="material-symbols-outlined icon-fill" style={{ color: "#fff", fontSize: "18px" }}>
                  auto_awesome
                </span>
              </div>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                Today&apos;s Summary
              </p>
            </div>
            <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
              {loading
                ? "Loading summary..."
                : error
                ? "Could not load summary."
                : totalEntities === 0
                ? "No active labourers or teams. Add from the sidebar pages."
                : isAttendanceCompleted
                ? `${presentLabours.length} labourers & ${presentTeams.length} teams present today. Total cost: ${formatCurrency(totalWage)}.`
                : `Attendance pending. Mark attendance to track costs accurately.`}
            </p>
          </div>

          {/* Attendance Action Card — always visible */}
          {!loading && !error && totalEntities > 0 && (
            <div
              className="rounded-2xl px-8 py-8 flex flex-col items-center gap-4 text-center"
              style={{
                backgroundColor: isAttendanceCompleted
                  ? "var(--color-surface-container-lowest)"
                  : "var(--color-surface-container-lowest)",
                border: isAttendanceCompleted
                  ? "1px solid var(--color-outline-variant)"
                  : "1.5px dashed var(--color-outline-variant)",
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isAttendanceCompleted
                    ? "#c1ecd4"
                    : "var(--color-surface-container-high)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "28px",
                    color: isAttendanceCompleted
                      ? "#2d7a4f"
                      : "var(--color-on-surface-variant)",
                  }}
                >
                  {isAttendanceCompleted ? "task_alt" : "pending_actions"}
                </span>
              </div>
              <div>
                <p className="text-body-md font-semibold mb-1" style={{ color: "var(--color-on-surface)" }}>
                  {isAttendanceCompleted
                    ? "Today's attendance is marked"
                    : "Please mark today's attendance"}
                </p>
                    
              </div>
              <Link
                href="/attendance/mark"
                id="mark-attendance-cta-btn"
                className="mt-1 h-12 px-8 rounded-xl text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: isAttendanceCompleted
                    ? "var(--color-surface-container)"
                    : "var(--color-primary)",
                  color: isAttendanceCompleted
                    ? "var(--color-on-surface)"
                    : "var(--color-on-primary)",
                  border: isAttendanceCompleted
                    ? "1px solid var(--color-outline-variant)"
                    : "none",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {isAttendanceCompleted ? "edit" : "checklist"}
                </span>
                {isAttendanceCompleted ? "Edit Attendance" : "Mark Today's Attendance"}
              </Link>
            </div>
          )}

          {/* Attendance completed — show present table */}
          {!loading && !error && isAttendanceCompleted && (presentLabours.length + presentTeams.length) > 0 && (
            <>
              <h2 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
                Today&apos;s Attendance
              </h2>
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                }}
              >
                {/* Scrollable table wrapper */}
                <div style={{ overflowX: "auto" }}>
                {/* Header row */}
                <div
                  className="grid px-5 py-3"
                  style={{
                    gridTemplateColumns: "minmax(120px,1fr) minmax(80px,1fr) minmax(100px,1fr) 70px",
                    borderBottom: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-low)",
                    minWidth: "380px",
                  }}
                >
                  {["Name", "Earned", "Task", "Time"].map((h) => (
                    <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                      {h}
                    </p>
                  ))}
                </div>

                {/* Labour rows — present only */}
                {presentLabours.map((record, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

                  return (
                    <div
                      key={record.labour_id}
                      className="grid items-center px-5 py-4"
                      style={{
                        gridTemplateColumns: "minmax(120px,1fr) minmax(80px,1fr) minmax(100px,1fr) 70px",
                        borderBottom: "1px solid var(--color-outline-variant)",
                        minWidth: "380px",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-label-caps flex-shrink-0"
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.color }}
                        >
                          {getInitials(record.labour_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                            {record.labour_name}
                          </p>
                          <span className="text-label-caps" style={{ color: "#2d7a4f" }}>Present</span>
                        </div>
                      </div>
                      <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                        {formatCurrency(record.wage_earned ?? 0)}
                      </p>
                      <p className="text-body-md truncate pr-2" style={{ color: "var(--color-on-surface-variant)" }}>
                        {record.task ?? "—"}
                      </p>
                      <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                        {record.hours_worked ? `${record.hours_worked}h` : "—"}
                      </p>
                    </div>
                  );
                })}

                {/* Team rows — present only */}
                {presentTeams.map((record) => (
                  <div
                    key={record.team_id}
                    className="grid items-center px-5 py-4"
                    style={{
                      gridTemplateColumns: "minmax(120px,1fr) minmax(80px,1fr) minmax(100px,1fr) 70px",
                      borderBottom: "1px solid var(--color-outline-variant)",
                      backgroundColor: "rgba(232,213,247,0.08)",
                      minWidth: "380px",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "#e8d5f7", color: "#3d1457" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>groups</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                          {record.team_name}
                        </p>
                        <span className="text-label-caps" style={{ color: "#6b21a8" }}>
                          Team · {record.num_labourers ?? 0} people
                        </span>
                      </div>
                    </div>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                      {formatCurrency(record.wage_earned ?? 0)}
                    </p>
                    <p className="text-body-md truncate pr-2" style={{ color: "var(--color-on-surface-variant)" }}>
                      {record.task ?? "—"}
                    </p>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                      {record.hours_worked ? `${record.hours_worked}h` : "—"}
                    </p>
                  </div>
                ))}

              </div> {/* end scrollable */}
              </div>

              {/* Bottom stat cards */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  className="px-6 py-5 rounded-2xl"
                  style={{
                    backgroundColor: "var(--color-surface-container-lowest)",
                    border: "1px solid var(--color-outline-variant)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-on-surface-variant)" }}>
                      payments
                    </span>
                    <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                      Today&apos;s Total Cost
                    </p>
                  </div>
                  <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>
                    {formatCurrency(totalWage)}
                  </p>
                </div>
                <div
                  className="px-6 py-5 rounded-2xl"
                  style={{
                    backgroundColor: "var(--color-surface-container-lowest)",
                    border: "1px solid var(--color-outline-variant)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-on-surface-variant)" }}>
                      groups
                    </span>
                    <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                      Present Today
                    </p>
                  </div>
                  <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>
                    {presentLabours.length + presentTeams.length}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* No labourers/teams at all */}
          {!loading && !error && totalEntities === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="material-symbols-outlined" style={{ fontSize: "56px", color: "var(--color-outline)" }}>
                groups
              </span>
              <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>No active labourers or teams</p>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Add labourers or teams from the sidebar to start tracking.
              </p>
              <Link
                href="/labours"
                className="mt-2 h-10 px-5 rounded-xl text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
                Add Labourers
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
