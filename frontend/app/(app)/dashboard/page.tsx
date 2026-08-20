"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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

type AttendanceStatus = "present" | "absent" | "half_day";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  present: {
    label: "Present",
    color: "#2d7a4f",
    bg: "#c1ecd4",
    icon: "check_circle",
  },
  half_day: {
    label: "Half Day",
    color: "#8b6914",
    bg: "#fef3c7",
    icon: "schedule",
  },
  absent: {
    label: "Absent",
    color: "var(--color-tertiary)",
    bg: "var(--color-tertiary-fixed)",
    icon: "cancel",
  },
};

export default function AttendancePage() {
  const today = todayISO();
  const [date] = useState(today);
  const [records, setRecords] = useState<LabourAttendanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [successId, setSuccessId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<LabourAttendanceStatus[]>(
        `/api/v1/attendance/daily?for_date=${date}`
      );
      setRecords(data);
      // Init task inputs from existing attendance
      const tasks: Record<string, string> = {};
      data.forEach((r) => {
        tasks[r.labour_id] = r.task ?? "";
      });
      setTaskInputs(tasks);
    } catch {
      setError("Failed to load attendance. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  async function markAttendance(
    record: LabourAttendanceStatus,
    newStatus: AttendanceStatus
  ) {
    const labour_id = record.labour_id;
    setSavingId(labour_id);
    setSuccessId(null);
    setErrorId(null);

    const task = taskInputs[labour_id] || undefined;
    const payload = {
      labour_id,
      date,
      status: newStatus,
      task: task || undefined,
    };

    try {
      if (record.attendance_id) {
        // Update existing
        await apiPatch(`/api/v1/attendance/${record.attendance_id}`, {
          status: newStatus,
          task: task || undefined,
        });
      } else {
        // Create new
        await apiPost("/api/v1/attendance", payload);
      }
      // Update local state optimistically
      setRecords((prev) =>
        prev.map((r) =>
          r.labour_id === labour_id
            ? {
                ...r,
                status: newStatus,
                task: task ?? r.task,
                wage_earned:
                  newStatus === "present"
                    ? r.daily_wage
                    : newStatus === "half_day"
                    ? r.daily_wage / 2
                    : 0,
              }
            : r
        )
      );
      setSuccessId(labour_id);
      setTimeout(() => setSuccessId(null), 2000);
      // Refresh to get the attendance_id for the new record
      await fetchAttendance();
    } catch (err) {
      setErrorId(labour_id);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setSavingId(null);
    }
  }

  const markedCount = records.filter((r) => r.status !== null).length;
  const presentCount = records.filter((r) => r.status === "present").length;
  const totalWage = records.reduce((sum, r) => sum + (r.wage_earned ?? 0), 0);
  const isComplete = records.length > 0 && markedCount === records.length;

  return (
    <>
      {/* Page Header */}
      <header
        className="px-[var(--spacing-container-margin)] py-10"
      >
        <p
          className="text-label-caps mb-1"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          {formatDateLong(date).toUpperCase()}
        </p>
        <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
          Today&apos;s Attendance
        </h1>
        <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
          Mark attendance for all active labourers.
        </p>
      </header>

      <div className="px-[var(--spacing-container-margin)] pb-12 flex flex-col gap-6">

        {/* Completion banner */}
        {!loading && !error && records.length > 0 && (
          <div
            className="flex items-center justify-between px-5 py-4 rounded-xl"
            style={{
              backgroundColor: isComplete
                ? "var(--color-primary-fixed)"
                : "var(--color-surface-container)",
              border: `1px solid ${isComplete ? "var(--color-primary-fixed-dim)" : "var(--color-outline-variant)"}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined"
                style={{
                  color: isComplete ? "var(--color-primary)" : "var(--color-tertiary)",
                  fontSize: "22px",
                }}
              >
                {isComplete ? "task_alt" : "warning"}
              </span>
              <div>
                <p
                  className="text-body-md font-semibold"
                  style={{ color: isComplete ? "var(--color-primary)" : "var(--color-on-surface)" }}
                >
                  {isComplete
                    ? "Today's attendance is complete"
                    : `Today's attendance: ${markedCount} / ${records.length} marked`}
                </p>
                {!isComplete && (
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    Ensure accurate daily wage calculations by marking all labourers.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {!loading && !error && records.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Workers Today
              </p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>
                {presentCount}
              </p>
            </div>
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Marked
              </p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>
                {markedCount} / {records.length}
              </p>
            </div>
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Today&apos;s Labour Cost
              </p>
              <p className="text-display-currency" style={{ color: "var(--color-primary)" }}>
                {formatCurrency(totalWage)}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }}
              />
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Loading attendance…
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="py-8 px-6 rounded-xl text-center"
            style={{
              backgroundColor: "var(--color-error-container)",
              color: "var(--color-on-error-container)",
            }}
          >
            <p className="text-body-lg font-semibold mb-2">Failed to load attendance</p>
            <p className="text-body-md mb-4">{error}</p>
            <button
              onClick={fetchAttendance}
              className="px-6 py-2 rounded-lg text-body-md font-semibold"
              style={{
                backgroundColor: "var(--color-on-error-container)",
                color: "var(--color-error-container)",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && records.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "64px", color: "var(--color-outline)" }}
            >
              groups
            </span>
            <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              No active labourers
            </p>
            <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
              Add labourers from the Labours page to track attendance.
            </p>
          </div>
        )}

        {/* Attendance list */}
        {!loading && !error && records.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: "1px solid var(--color-outline-variant)",
              backgroundColor: "var(--color-surface-container-lowest)",
            }}
          >
            {records.map((record, idx) => {
              const isSaving = savingId === record.labour_id;
              const isSuccess = successId === record.labour_id;
              const isError = errorId === record.labour_id;
              const cfg = record.status ? STATUS_CONFIG[record.status] : null;

              return (
                <div
                  key={record.labour_id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 transition-colors"
                  style={{
                    borderBottom:
                      idx < records.length - 1
                        ? "1px solid var(--color-outline-variant)"
                        : "none",
                    backgroundColor: isSuccess
                      ? "var(--color-primary-fixed)"
                      : "transparent",
                  }}
                >
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-body-md font-bold flex-shrink-0"
                      style={{
                        backgroundColor: "var(--color-primary-fixed)",
                        color: "var(--color-primary)",
                      }}
                    >
                      {getInitials(record.labour_name)}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-body-md font-semibold truncate"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        {record.labour_name}
                      </p>
                      <p
                        className="text-label-caps"
                        style={{ color: "var(--color-on-surface-variant)" }}
                      >
                        {formatCurrency(record.daily_wage)}/day
                        {record.hometown ? ` · ${record.hometown}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Task input */}
                  <div className="flex-1 min-w-0 max-w-xs">
                    <input
                      type="text"
                      value={taskInputs[record.labour_id] ?? ""}
                      onChange={(e) =>
                        setTaskInputs((prev) => ({
                          ...prev,
                          [record.labour_id]: e.target.value,
                        }))
                      }
                      placeholder="Task (optional)"
                      className="w-full h-9 px-3 rounded-lg text-body-md transition-colors"
                      style={{
                        border: "1px solid var(--color-outline-variant)",
                        backgroundColor: "var(--color-surface-container)",
                        color: "var(--color-on-surface)",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Status badge */}
                  {cfg && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-caps flex-shrink-0"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                        {cfg.icon}
                      </span>
                      {cfg.label}
                    </span>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    {(["present", "half_day", "absent"] as AttendanceStatus[]).map((s) => {
                      const c = STATUS_CONFIG[s];
                      const isActive = record.status === s;
                      return (
                        <button
                          key={s}
                          disabled={isSaving}
                          onClick={() => markAttendance(record, s)}
                          id={`attendance-${record.labour_id}-${s}`}
                          title={c.label}
                          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            backgroundColor: isActive ? c.bg : "var(--color-surface-container)",
                            color: isActive ? c.color : "var(--color-on-surface-variant)",
                            border: isActive
                              ? `1.5px solid ${c.color}`
                              : "1px solid var(--color-outline-variant)",
                            opacity: isSaving ? 0.6 : 1,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {c.icon}
                          </span>
                        </button>
                      );
                    })}

                    {/* Saving indicator */}
                    {isSaving && (
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "var(--color-surface-container)" }}
                      >
                        <div
                          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor: "var(--color-primary)" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Error indicator */}
                  {isError && (
                    <span
                      className="text-label-caps flex items-center gap-1"
                      style={{ color: "var(--color-error)" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                        error
                      </span>
                      Failed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
