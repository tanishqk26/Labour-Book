"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  work_start_time: string | null;
  work_end_time: string | null;
  wage_earned: number | null;
}

interface AllLabour {
  id: string;
  name: string;
  hometown: string | null;
  daily_wage: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = [
  { bg: "#c1ecd4", color: "#012d1d" },
  { bg: "#d7e4f0", color: "#111d25" },
  { bg: "#fef3c7", color: "#6b4c04" },
  { bg: "#ffdad3", color: "#510900" },
  { bg: "#e8d5f7", color: "#3d1457" },
];

// Add Labour to list picker modal
function AddLabourModal({
  allLabours,
  presentIds,
  onAdd,
  onClose,
}: {
  allLabours: AllLabour[];
  presentIds: Set<string>;
  onAdd: (labour: AllLabour) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const available = allLabours.filter(
    (l) => !presentIds.has(l.id) && l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: "none" }}>
        <div
          className="flex flex-col shadow-2xl"
          style={{
            width: "min(480px, 100%)",
            maxHeight: "80vh",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-outline-variant)",
            borderRadius: "var(--radius-lg)",
            pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
          >
            <h3 className="text-headline-md" style={{ color: "var(--color-primary)" }}>Add to Today&apos;s List</h3>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labourer..."
              autoFocus
              className="w-full h-10 px-3 rounded-lg text-body-md"
              style={{
                border: "1px solid var(--color-outline-variant)",
                backgroundColor: "var(--color-surface-container-lowest)",
                color: "var(--color-on-surface)",
                outline: "none",
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {available.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  {search ? "No matching labourers" : "All active labourers are already in the list"}
                </p>
              </div>
            )}
            {available.map((labour) => (
              <button
                key={labour.id}
                onClick={() => { onAdd(labour); onClose(); }}
                className="w-full flex items-center gap-3 px-6 py-3 text-left transition-colors hover:opacity-80"
                style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-label-caps flex-shrink-0"
                  style={{ backgroundColor: "var(--color-primary-fixed)", color: "var(--color-primary)" }}
                >
                  {getInitials(labour.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>{labour.name}</p>
                  {labour.hometown && (
                    <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{labour.hometown}</p>
                  )}
                </div>
                <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  {formatCurrency(labour.daily_wage)}/day
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function MarkAttendancePage() {
  const today = todayISO();
  const router = useRouter();

  // All active labours from API (for adding to list)
  const [allLabours, setAllLabours] = useState<AllLabour[]>([]);
  // Working list — the labours we're tracking today
  const [list, setList] = useState<LabourAttendanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row state
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [startTimeInputs, setStartTimeInputs] = useState<Record<string, string>>({});
  const [endTimeInputs, setEndTimeInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch today's attendance + all labours
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailyData, laboursData] = await Promise.all([
        apiGet<LabourAttendanceStatus[]>(`/api/v1/attendance/daily?for_date=${today}`),
        apiGet<{ items: AllLabour[] }>("/api/v1/labours?status=active&page_size=100"),
      ]);
      setList(dailyData);
      setAllLabours(laboursData.items);
      // Init per-row inputs from existing attendance data
      const tasks: Record<string, string> = {};
      const starts: Record<string, string> = {};
      const ends: Record<string, string> = {};
      dailyData.forEach((r) => {
        tasks[r.labour_id] = r.task ?? "";
        starts[r.labour_id] = r.work_start_time ?? "";
        ends[r.labour_id] = r.work_end_time ?? "";
      });
      setTaskInputs(tasks);
      setStartTimeInputs(starts);
      setEndTimeInputs(ends);
    } catch {
      setError("Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add a labour to working list (they weren't in daily list before)
  function addToList(labour: AllLabour) {
    setList((prev) => [
      ...prev,
      {
        labour_id: labour.id,
        labour_name: labour.name,
        daily_wage: labour.daily_wage,
        hometown: labour.hometown,
        attendance_id: null,
        status: null,
        task: null,
        hours_worked: null,
        work_start_time: null,
        work_end_time: null,
        wage_earned: null,
      },
    ]);
    setTaskInputs((p) => ({ ...p, [labour.id]: "" }));
    setStartTimeInputs((p) => ({ ...p, [labour.id]: "" }));
    setEndTimeInputs((p) => ({ ...p, [labour.id]: "" }));
  }

  // Remove from list (will be treated as absent by default)
  function removeFromList(labourId: string) {
    setList((prev) => prev.filter((r) => r.labour_id !== labourId));
  }

  async function markPresent(record: LabourAttendanceStatus) {
    const labour_id = record.labour_id;
    setSavingId(labour_id);
    setSuccessId(null);
    setErrorId(null);

    const task = taskInputs[labour_id] || undefined;
    const startTime = startTimeInputs[labour_id] || undefined;
    const endTime = endTimeInputs[labour_id] || undefined;

    // Calculate hours if both provided
    let hours_worked: number | undefined;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) hours_worked = parseFloat((diff / 60).toFixed(2));
    }

    const payload = {
      labour_id,
      date: today,
      status: "present" as const,
      task: task || undefined,
      hours_worked,
      work_start_time: startTime || undefined,
      work_end_time: endTime || undefined,
    };

    try {
      if (record.attendance_id) {
        await apiPatch(`/api/v1/attendance/${record.attendance_id}`, {
          status: "present",
          task: task || undefined,
          hours_worked,
          work_start_time: startTime || undefined,
          work_end_time: endTime || undefined,
        });
      } else {
        await apiPost("/api/v1/attendance", payload);
      }
      setList((prev) =>
        prev.map((r) =>
          r.labour_id === labour_id
            ? { ...r, status: "present", task: task ?? r.task, hours_worked: hours_worked ?? r.hours_worked, wage_earned: r.daily_wage }
            : r
        )
      );
      setSuccessId(labour_id);
      setTimeout(() => setSuccessId(null), 2000);
      await fetchData();
    } catch {
      setErrorId(labour_id);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setSavingId(null);
    }
  }

  const presentCount = list.filter((r) => r.status === "present").length;
  const markedCount = list.filter((r) => r.status !== null).length;
  const totalWage = list.reduce((sum, r) => sum + (r.wage_earned ?? 0), 0);
  const presentIds = new Set(list.map((r) => r.labour_id));

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      <title>Mark Attendance | LabourBook</title>

      {showAddModal && (
        <AddLabourModal
          allLabours={allLabours}
          presentIds={presentIds}
          onAdd={addToList}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        {/* Header */}
        <header
          className="px-8 py-6 flex items-center gap-4"
          style={{ borderBottom: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface)" }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-on-surface-variant)", border: "1px solid var(--color-outline-variant)" }}
            aria-label="Back to dashboard"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <div className="flex-1">
            <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{dateLabel.toUpperCase()}</p>
            <h1 className="text-headline-md" style={{ color: "var(--color-primary)" }}>Mark Today&apos;s Attendance</h1>
          </div>
          {/* Quick stats */}
          {!loading && list.length > 0 && (
            <div className="flex items-center gap-6 mr-2">
              <div className="text-center">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Present</p>
                <p className="text-headline-md font-bold" style={{ color: "#2d7a4f" }}>{presentCount}</p>
              </div>
              <div className="text-center">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Total Cost</p>
                <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>{formatCurrency(totalWage)}</p>
              </div>
            </div>
          )}
        </header>

        <div className="px-8 py-6 flex flex-col gap-4">

          {/* Info banner */}
          {!loading && !error && (
            <div
              className="px-5 py-3 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-on-surface-variant)" }}>
                info
              </span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Mark <strong>Present</strong> for labourers who worked today. Labourers not in this list are treated as <strong>absent</strong> by default. Yesterday&apos;s list is carried forward automatically.
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--color-primary)" }}
                />
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Loading...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="py-6 px-5 rounded-xl text-center"
              style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}
            >
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={fetchData} className="px-5 py-2 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}>
                Try Again
              </button>
            </div>
          )}

          {/* Attendance list */}
          {!loading && !error && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid var(--color-outline-variant)",
                backgroundColor: "var(--color-surface-container-lowest)",
              }}
            >
              {/* Column headers */}
              <div
                className="flex items-center px-5 py-3 gap-4"
                style={{
                  borderBottom: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-low)",
                }}
              >
                <div style={{ flex: "0 0 200px" }}>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Name</p>
                </div>
                <div className="flex-1">
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Task (optional)</p>
                </div>
                <div style={{ flex: "0 0 220px" }}>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Timing (optional)</p>
                </div>
                <div style={{ flex: "0 0 160px" }}>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Actions</p>
                </div>
              </div>

              {/* Empty list */}
              {list.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--color-outline)" }}>
                    groups
                  </span>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    No labourers in the list. Use the button below to add.
                  </p>
                </div>
              )}

              {/* Rows */}
              {list.map((record, idx) => {
                const isSaving = savingId === record.labour_id;
                const isSuccess = successId === record.labour_id;
                const isError = errorId === record.labour_id;
                const isPresent = record.status === "present";
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

                return (
                  <div
                    key={record.labour_id}
                    className="flex items-center px-5 py-4 gap-4 transition-colors"
                    style={{
                      borderBottom: idx < list.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                      backgroundColor: isSuccess
                        ? "var(--color-primary-fixed)"
                        : isPresent
                        ? "rgba(193,236,212,0.15)"
                        : "transparent",
                    }}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3" style={{ flex: "0 0 200px" }}>
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
                        {isPresent && (
                          <span className="text-label-caps" style={{ color: "#2d7a4f" }}>Present ✓</span>
                        )}
                        {record.status === null && (
                          <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>Not marked</span>
                        )}
                      </div>
                    </div>

                    {/* Task input */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={taskInputs[record.labour_id] ?? ""}
                        onChange={(e) => setTaskInputs((prev) => ({ ...prev, [record.labour_id]: e.target.value }))}
                        placeholder="e.g. Crop spraying"
                        className="w-full h-9 px-3 rounded-lg text-body-md"
                        style={{
                          border: "1px solid var(--color-outline-variant)",
                          backgroundColor: "var(--color-surface-container)",
                          color: "var(--color-on-surface)",
                          outline: "none",
                        }}
                      />
                    </div>

                    {/* Timing inputs */}
                    <div className="flex items-center gap-2" style={{ flex: "0 0 220px" }}>
                      <input
                        type="time"
                        value={startTimeInputs[record.labour_id] ?? ""}
                        onChange={(e) => setStartTimeInputs((prev) => ({ ...prev, [record.labour_id]: e.target.value }))}
                        className="h-9 px-2 rounded-lg text-body-md"
                        style={{
                          flex: 1,
                          border: "1px solid var(--color-outline-variant)",
                          backgroundColor: "var(--color-surface-container)",
                          color: "var(--color-on-surface)",
                          outline: "none",
                        }}
                      />
                      <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>to</span>
                      <input
                        type="time"
                        value={endTimeInputs[record.labour_id] ?? ""}
                        onChange={(e) => setEndTimeInputs((prev) => ({ ...prev, [record.labour_id]: e.target.value }))}
                        className="h-9 px-2 rounded-lg text-body-md"
                        style={{
                          flex: 1,
                          border: "1px solid var(--color-outline-variant)",
                          backgroundColor: "var(--color-surface-container)",
                          color: "var(--color-on-surface)",
                          outline: "none",
                        }}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2" style={{ flex: "0 0 160px" }}>
                      {/* Mark Present button */}
                      <button
                        disabled={isSaving || isPresent}
                        onClick={() => markPresent(record)}
                        id={`mark-present-${record.labour_id}`}
                        className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-label-caps font-semibold transition-all"
                        style={{
                          backgroundColor: isPresent ? "#c1ecd4" : "var(--color-primary)",
                          color: isPresent ? "#2d7a4f" : "var(--color-on-primary)",
                          opacity: isSaving ? 0.6 : 1,
                          cursor: isPresent ? "default" : "pointer",
                        }}
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "white" }} />
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {isPresent ? "check_circle" : "check"}
                          </span>
                        )}
                        {isPresent ? "Present" : "Mark Present"}
                      </button>

                      {/* Remove from list */}
                      <button
                        onClick={() => removeFromList(record.labour_id)}
                        title="Remove from today's list (will count as absent)"
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                        style={{
                          border: "1px solid var(--color-outline-variant)",
                          color: "var(--color-on-surface-variant)",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>remove</span>
                      </button>

                      {/* Error indicator */}
                      {isError && (
                        <span className="text-label-caps" style={{ color: "var(--color-error)" }}>Failed</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add labour row */}
              <div
                className="px-5 py-4"
                style={{ borderTop: list.length > 0 ? "1px solid var(--color-outline-variant)" : "none" }}
              >
                <button
                  onClick={() => setShowAddModal(true)}
                  id="add-labour-to-list-btn"
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-body-md font-semibold transition-opacity hover:opacity-80"
                  style={{
                    border: "1.5px dashed var(--color-outline-variant)",
                    color: "var(--color-on-surface-variant)",
                    backgroundColor: "transparent",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
                  Add labour to today&apos;s list
                </button>
              </div>
            </div>
          )}

          {/* Summary footer */}
          {!loading && !error && list.length > 0 && (
            <div
              className="flex items-center justify-between px-6 py-4 rounded-2xl"
              style={{
                backgroundColor: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <div className="flex gap-8">
                <div>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>In List</p>
                  <p className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>{list.length}</p>
                </div>
                <div>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Present</p>
                  <p className="text-headline-md font-bold" style={{ color: "#2d7a4f" }}>{presentCount}</p>
                </div>
                <div>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Today&apos;s Cost</p>
                  <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>{formatCurrency(totalWage)}</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="h-11 px-6 rounded-xl text-body-md font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
