"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiFetch } from "@/lib/api";
import { Labour } from "@/types";
import { formatCurrency, getInitials } from "@/lib/utils";
import LabourDrawer from "@/components/LabourDrawer";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | "half_day";
  task: string | null;
  hours_worked: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  wage_earned: number;
}

interface ContractRecord {
  id: string;
  title: string;
  description?: string;
  amount: number;
  assigned_date: string;
  completed_date?: string;
  status: "active" | "completed" | "cancelled";
}

function contractStatusColor(status: string) {
  if (status === "active") return { bg: "#c1ecd4", text: "#012d1d" };
  if (status === "completed") return { bg: "#d7e4f0", text: "#111d25" };
  return { bg: "#ffdad3", text: "#510900" };
}

const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
};
const STATUS_COLORS: Record<string, string> = {
  present: "#2d7a4f",
  absent: "var(--color-tertiary)",
  half_day: "#a16207",
};

export default function LabourDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [labour, setLabour] = useState<Labour | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // History
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Contracts
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function fetchLabour() {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await apiGet<Labour>(`/api/v1/labours/${id}`);
      setLabour(data);
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      if (apiErr?.status === 404) {
        setNotFound(true);
      } else {
        setError("Failed to load labour profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<AttendanceRecord[]>(
        `/api/v1/attendance/labour/${id}/history?limit=100`
      );
      setHistory(data);
    } catch {
      // silently fail — history is supplementary
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    try {
      const data = await apiGet<{ items: ContractRecord[] }>(
        `/api/v1/contracts?entity_type=individual&labour_id=${id}&page_size=100`
      );
      setContracts(data.items);
    } catch {
      // silently fail
    } finally {
      setContractsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLabour();
    fetchHistory();
    fetchContracts();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/v1/labours/${id}/hard`, { method: "DELETE" });
      router.push("/labours");
    } catch {
      setDeleteError("Failed to delete. Please try again.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)" }}
          />
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  /* ---- Not found ---- */
  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)" }}>
          person_off
        </span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Labour not found</p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          The profile you are looking for does not exist.
        </p>
        <Link href="/labours" className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
          Back to Labours
        </Link>
      </div>
    );
  }

  /* ---- Error ---- */
  if (error || !labour) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-error)" }}>
          error_outline
        </span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Something went wrong</p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{error}</p>
        <button onClick={fetchLabour} className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
          Try Again
        </button>
      </div>
    );
  }

  const workingTime =
    labour.work_start_time && labour.work_end_time
      ? `${labour.work_start_time} – ${labour.work_end_time}`
      : "—";

  const totalEarned = history.filter(r => r.status === "present" || r.status === "half_day")
    .reduce((s, r) => s + (r.wage_earned ?? 0), 0);
  const daysPresent = history.filter(r => r.status === "present" || r.status === "half_day").length;

  return (
    <>
      <LabourDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={fetchLabour}
        labour={labour}
      />

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setConfirmDelete(false)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--color-error-container)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-error)" }}>
                    delete_forever
                  </span>
                </div>
                <div>
                  <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                    Delete {labour.name}?
                  </p>
                  <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                    This will permanently delete this labourer and all their attendance records. This action cannot be undone.
                  </p>
                </div>
              </div>
              {deleteError && (
                <p className="text-body-md px-3 py-2 rounded-lg"
                  style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
                  {deleteError}
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="h-10 px-5 rounded-lg text-body-md font-semibold"
                  style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-error)", color: "#fff" }}
                >
                  {deleting ? "Deleting…" : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Breadcrumb + Actions */}
      <header
        className="px-[var(--spacing-container-margin)] py-6 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
      >
        <Link
          href="/labours"
          className="flex items-center gap-2 text-label-caps transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          Labour Directory
        </Link>
        <div className="flex items-center gap-3">
          <button
            id="edit-labour-btn"
            onClick={() => setEditOpen(true)}
            className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
            Edit Profile
          </button>
          <button
            id="delete-labour-btn"
            onClick={() => setConfirmDelete(true)}
            className="h-10 px-4 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ border: "1px solid var(--color-error)", color: "var(--color-error)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
          </button>
        </div>
      </header>

      <div className="px-[var(--spacing-container-margin)] py-8 flex flex-col gap-8">
        {/* Profile Card */}
        <div
          className="rounded-xl p-8 relative overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-outline-variant)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5"
            style={{ backgroundColor: "var(--color-primary)", transform: "translate(30%, -30%)" }}
          />

          <div className="flex items-start gap-6 mb-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0"
              style={{ backgroundColor: "var(--color-secondary-container)", color: "var(--color-on-secondary-fixed)" }}
            >
              {getInitials(labour.name)}
            </div>
            <div>
              <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)" }}>{labour.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: labour.status === "active" ? "#2d7a4f" : "var(--color-outline)" }}
                />
                <span
                  className="text-body-md font-medium"
                  style={{ color: labour.status === "active" ? "#2d7a4f" : "var(--color-on-surface-variant)" }}
                >
                  {labour.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {labour.hometown && (
              <div>
                <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>location_on</span>
                  Hometown
                </p>
                <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>{labour.hometown}</p>
              </div>
            )}
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>payments</span>
                Daily Wage
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(labour.daily_wage)}/day
              </p>
            </div>
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>schedule</span>
                Working Time
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>{workingTime}</p>
            </div>
          </div>

          {(labour.phone || labour.aadhaar) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6"
              style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
              {labour.phone && (
                <div>
                  <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>Phone Number</p>
                  <p className="text-body-md font-medium flex items-center gap-2" style={{ color: "var(--color-on-surface)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>call</span>
                    {labour.phone}
                  </p>
                </div>
              )}
              {labour.aadhaar && (
                <div>
                  <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>Aadhaar Number</p>
                  <p className="text-body-md font-medium flex items-center gap-2" style={{ color: "var(--color-on-surface)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>fingerprint</span>
                    {labour.aadhaar}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick stats from history */}
        {history.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>Days Worked</p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>{daysPresent}</p>
            </div>
            <div className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>Total Earned</p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>{formatCurrency(totalEarned)}</p>
            </div>
          </div>
        )}

        {/* Attendance History */}
        <section>
          <h2 className="text-headline-md mb-4" style={{ color: "var(--color-on-surface)" }}>
            Attendance History
          </h2>

          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }} />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>history</span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                No attendance records yet.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
              {/* Header */}
              <div className="grid px-5 py-3"
                style={{
                  gridTemplateColumns: "120px 90px 1fr 80px 90px",
                  borderBottom: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-low)",
                }}>
                {["Date", "Status", "Task", "Time", "Wage"].map(h => (
                  <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{h}</p>
                ))}
              </div>
              {history.map((rec, idx) => (
                <div key={rec.id} className="grid items-center px-5 py-3"
                  style={{
                    gridTemplateColumns: "120px 90px 1fr 80px 90px",
                    borderBottom: idx < history.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                  }}>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface)" }}>
                    {new Date(rec.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                  <span className="text-label-caps font-semibold"
                    style={{ color: STATUS_COLORS[rec.status] ?? "var(--color-on-surface-variant)" }}>
                    {STATUS_LABELS[rec.status] ?? rec.status}
                  </span>
                  <p className="text-body-md truncate pr-3" style={{ color: "var(--color-on-surface-variant)" }}>
                    {rec.task || "—"}
                  </p>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    {rec.hours_worked ? `${rec.hours_worked}h` : "—"}
                  </p>
                  <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                    {rec.wage_earned > 0 ? formatCurrency(rec.wage_earned) : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Contract History */}
        <section>
          <h2 className="text-headline-md mb-4" style={{ color: "var(--color-on-surface)" }}>
            Contract History
          </h2>

          {contractsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }} />
            </div>
          ) : contracts.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>description</span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                No contracts assigned yet.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
              <div style={{ overflowX: "auto" }}>
                {/* Header */}
                <div className="grid px-5 py-3"
                  style={{
                    gridTemplateColumns: "minmax(160px,2fr) 110px minmax(90px,1fr) 80px",
                    borderBottom: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-low)",
                    minWidth: "400px",
                  }}>
                  {["Work / Title", "Assigned", "Amount", "Status"].map(h => (
                    <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{h}</p>
                  ))}
                </div>
                {contracts.map((c, idx) => {
                  const sc = contractStatusColor(c.status);
                  return (
                    <div key={c.id} className="grid items-center px-5 py-3"
                      style={{
                        gridTemplateColumns: "minmax(160px,2fr) 110px minmax(90px,1fr) 80px",
                        borderBottom: idx < contracts.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                        minWidth: "400px",
                      }}>
                      <div className="min-w-0 pr-3">
                        <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>{c.title}</p>
                        {c.description && (
                          <p className="text-label-caps truncate" style={{ color: "var(--color-on-surface-variant)" }}>{c.description}</p>
                        )}
                      </div>
                      <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                        {new Date(c.assigned_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-body-md font-semibold" style={{ color: "var(--color-primary)" }}>
                        {formatCurrency(c.amount)}
                      </p>
                      <span className="text-label-caps px-2 py-1 rounded-full inline-block"
                        style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
