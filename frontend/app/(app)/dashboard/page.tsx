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
  const [records, setRecords] = useState<LabourAttendanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<LabourAttendanceStatus[]>(
        `/api/v1/attendance/daily?for_date=${today}`
      );
      setRecords(data);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const presentRecords = records.filter((r) => r.status === "present");
  const markedCount = records.filter((r) => r.status !== null).length;
  const totalWage = records.reduce((sum, r) => sum + (r.wage_earned ?? 0), 0);
  const isComplete = records.length > 0 && markedCount === records.length;
  const allAbsent = records.length > 0 && presentRecords.length === 0 && isComplete;

  const dateLabel = new Date()
    .toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <>
      <title>Dashboard | LabourBook</title>

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        {/* Page Header */}
        <header className="px-8 pt-10 pb-6">
          <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            {dateLabel}
          </p>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)" }}>
            {getGreeting()},{" "}
            <span style={{ color: "var(--color-primary)" }}>Farm Manager</span>
          </h1>
          <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Here&apos;s what happened on your farm today.
          </p>
        </header>

        <div className="px-8 pb-12 flex flex-col gap-6">

          {/* Attendance completion banner */}
          {!loading && !error && (
            <div
              className="flex items-center justify-between px-6 py-5 rounded-2xl"
              style={{
                backgroundColor: isComplete && !allAbsent
                  ? "var(--color-primary-fixed)"
                  : "var(--color-surface-container-low)",
                border: `1px solid ${
                  isComplete && !allAbsent
                    ? "var(--color-primary-fixed-dim)"
                    : "var(--color-outline-variant)"
                }`,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="material-symbols-outlined mt-0.5"
                  style={{
                    color: isComplete && !allAbsent ? "var(--color-primary)" : "var(--color-tertiary)",
                    fontSize: "22px",
                  }}
                >
                  {isComplete && !allAbsent ? "task_alt" : "warning"}
                </span>
                <div>
                  <p
                    className="text-body-md font-semibold"
                    style={{
                      color: isComplete && !allAbsent ? "var(--color-primary)" : "var(--color-on-surface)",
                    }}
                  >
                    {isComplete && !allAbsent
                      ? "Today's attendance is complete"
                      : "Today's attendance: Not completed"}
                  </p>
                  {!(isComplete && !allAbsent) && (
                    <p className="text-body-md mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>
                      Ensure accurate daily wage calculations by marking attendance before end of day.
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/attendance/mark"
                id="mark-attendance-btn"
                className="ml-6 flex-shrink-0 h-11 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                Mark Today&apos;s Attendance
              </Link>
            </div>
          )}

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
                : records.length === 0
                ? "No active labourers found. Add labourers from the Labours page."
                : isComplete
                ? `${presentRecords.length} of ${records.length} labourers present today. Total labour cost: ${formatCurrency(totalWage)}.`
                : `Attendance pending for ${records.length - markedCount} labourer${
                    records.length - markedCount !== 1 ? "s" : ""
                  }. Mark attendance to track costs accurately.`}
            </p>
          </div>

          {/* Today's Attendance table */}
          <div>
            <h2 className="text-headline-md mb-4" style={{ color: "var(--color-on-surface)" }}>
              Today&apos;s Attendance
            </h2>

            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--color-primary)" }}
                  />
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Loading...</p>
                </div>
              </div>
            )}

            {!loading && error && (
              <div
                className="py-6 px-5 rounded-xl text-center"
                style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}
              >
                <p className="text-body-md font-semibold mb-2">Failed to load attendance</p>
                <button
                  onClick={fetchAttendance}
                  className="px-5 py-2 rounded-lg text-body-md font-semibold"
                  style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}
                >
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && records.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="material-symbols-outlined" style={{ fontSize: "56px", color: "var(--color-outline)" }}>
                  groups
                </span>
                <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>No active labourers</p>
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  Add labourers from the Labours page to start tracking.
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

            {!loading && !error && records.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                }}
              >
                {/* Header row */}
                <div
                  className="grid px-5 py-3"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr 80px",
                    borderBottom: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-low)",
                  }}
                >
                  {["Name", "Detail", "Task", "Time"].map((h) => (
                    <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                      {h}
                    </p>
                  ))}
                </div>

                {records.map((record, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const isPresent = record.status === "present";
                  const isAbsent = record.status === "absent";
                  const isUnmarked = record.status === null;

                  return (
                    <div
                      key={record.labour_id}
                      className="grid items-center px-5 py-4"
                      style={{
                        gridTemplateColumns: "1fr 1fr 1fr 80px",
                        borderBottom: idx < records.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                        opacity: isAbsent ? 0.5 : 1,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-label-caps flex-shrink-0"
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.color }}
                        >
                          {getInitials(record.labour_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                            {record.labour_name}
                          </p>
                          {isPresent && <span className="text-label-caps" style={{ color: "#2d7a4f" }}>Present</span>}
                          {isAbsent && <span className="text-label-caps" style={{ color: "var(--color-tertiary)" }}>Absent</span>}
                          {isUnmarked && <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>Not marked</span>}
                        </div>
                      </div>
                      <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Individual</p>
                      <p className="text-body-md truncate pr-2" style={{ color: "var(--color-on-surface-variant)" }}>
                        {record.task ?? "—"}
                      </p>
                      <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                        {record.hours_worked ? `${record.hours_worked}h` : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom stat cards */}
          {!loading && !error && records.length > 0 && (
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
                    Today&apos;s Labour Cost
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
                    Workers Today
                  </p>
                </div>
                <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>
                  {presentRecords.length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
