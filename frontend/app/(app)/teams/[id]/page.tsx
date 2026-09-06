"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiFetch } from "@/lib/api";
import { Team, EntityPaymentSummary, PaymentRead, PaginatedPayments } from "@/types";
import { formatCurrency, formatMediumDate, getInitials } from "@/lib/utils";
import TeamModal from "@/components/TeamModal";
import PaymentModal from "@/components/PaymentModal";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TeamAttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | null;
  num_labourers: number | null;
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

export default function TeamDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Attendance History
  const [history, setHistory] = useState<TeamAttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  // Contract History
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractFrom, setContractFrom] = useState("");
  const [contractTo, setContractTo] = useState("");

  // Payments
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<EntityPaymentSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Settle
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function fetchTeam() {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await apiGet<Team>(`/api/v1/teams/${id}`);
      setTeam(data);
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      if (apiErr?.status === 404) {
        setNotFound(true);
      } else {
        setError("Failed to load team.");
      }
    } finally {
      setLoading(false);
    }
  }

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<TeamAttendanceRecord[]>(
        `/api/v1/attendance/team/${id}/history?limit=100`
      );
      setHistory(data);
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    try {
      const data = await apiGet<{ items: ContractRecord[] }>(
        `/api/v1/contracts?entity_type=team&team_id=${id}&page_size=100`
      );
      setContracts(data.items);
    } catch {
      // silently fail
    } finally {
      setContractsLoading(false);
    }
  }, [id]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const [summaryData, listData] = await Promise.all([
        apiGet<EntityPaymentSummary>(`/api/v1/payments/entity/team/${id}/summary`),
        apiGet<PaginatedPayments>(`/api/v1/payments`, { team_id: id, page_size: 50 }),
      ]);
      setPaymentSummary(summaryData);
      setPayments(listData.items);
    } catch {
      // silently fail
    } finally {
      setPaymentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTeam();
    fetchHistory();
    fetchContracts();
    fetchPayments();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/v1/teams/${id}/hard`, { method: "DELETE" });
      router.push("/teams");
    } catch {
      setDeleteError("Failed to delete. Please try again.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleSettle() {
    if (!paymentSummary || paymentSummary.pending <= 0) return;
    setSettling(true);
    setSettleError(null);
    try {
      await apiPost("/api/v1/payments", {
        team_id: id,
        amount: paymentSummary.pending,
        method: "cash",
        date: new Date().toISOString().slice(0, 10),
        notes: "Settlement — full balance cleared",
      });
      setConfirmSettle(false);
      fetchPayments();
    } catch {
      setSettleError("Settlement failed. Please try again.");
    } finally {
      setSettling(false);
    }
  }

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)" }} />
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Loading team…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)" }}>group_off</span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Team not found</p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          The team you are looking for does not exist.
        </p>
        <Link href="/teams" className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
          Back to Teams
        </Link>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-error)" }}>error_outline</span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Something went wrong</p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{error}</p>
        <button onClick={fetchTeam} className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
          Try Again
        </button>
      </div>
    );
  }

  const presentRecords = history.filter(r => r.status === "present");
  const totalEarned = presentRecords.reduce((s, r) => s + (r.wage_earned ?? 0), 0);

  const filteredHistory = history.filter(r => {
    if (historyFrom && r.date < historyFrom) return false;
    if (historyTo && r.date > historyTo) return false;
    return true;
  });
  const filteredContracts = contracts.filter(c => {
    if (contractFrom && c.assigned_date < contractFrom) return false;
    if (contractTo && c.assigned_date > contractTo) return false;
    return true;
  });

  return (
    <>
      <TeamModal open={editOpen} onClose={() => setEditOpen(false)} onSuccess={fetchTeam} team={team} />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={fetchPayments}
        preselectedEntityType="team"
        preselectedEntityId={id}
      />

      {/* Settle Confirmation Modal */}
      {confirmSettle && paymentSummary && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
            onClick={() => { setConfirmSettle(false); setSettleError(null); }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-outline-variant)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
                <h2 className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>Settle Balance</h2>
                <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>for {team?.name}</p>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div
                  className="rounded-xl px-5 py-4 flex flex-col gap-3"
                  style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}
                >
                  <div className="flex justify-between">
                    <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Total Earned</span>
                    <span className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>{formatCurrency(paymentSummary.total_earned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Total Paid</span>
                    <span className="text-body-md font-semibold" style={{ color: "#2d7a4f" }}>{formatCurrency(paymentSummary.total_paid)}</span>
                  </div>
                  <div className="flex justify-between pt-3" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
                    <span className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>Outstanding</span>
                    <span className="text-body-md font-bold" style={{ color: "var(--color-error)" }}>{formatCurrency(paymentSummary.pending)}</span>
                  </div>
                </div>
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  This will record a cash payment of{" "}
                  <strong style={{ color: "var(--color-on-surface)" }}>{formatCurrency(paymentSummary.pending)}</strong>{" "}
                  to clear the full outstanding balance.
                </p>
                {settleError && (
                  <p className="text-body-md px-3 py-2 rounded-lg"
                    style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
                    {settleError}
                  </p>
                )}
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => { setConfirmSettle(false); setSettleError(null); }}
                  className="flex-1 h-11 rounded-xl text-body-md font-semibold"
                  style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
                >
                  Cancel
                </button>
                <button
                  id="settle-confirm-btn"
                  onClick={handleSettle}
                  disabled={settling}
                  className="flex-1 h-11 rounded-xl text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                >
                  {settling ? "Settling…" : `Settle ${formatCurrency(paymentSummary.pending)}`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setConfirmDelete(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-outline-variant)" }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--color-error-container)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-error)" }}>
                    delete_forever
                  </span>
                </div>
                <div>
                  <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                    Delete {team.name}?
                  </p>
                  <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                    This will permanently delete this team and all their attendance records. This action cannot be undone.
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
                <button onClick={() => setConfirmDelete(false)}
                  className="h-10 px-5 rounded-lg text-body-md font-semibold"
                  style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-error)", color: "#fff" }}>
                  {deleting ? "Deleting…" : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <header className="px-4 md:px-[var(--spacing-container-margin)] py-6 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
        <Link href="/teams" className="flex items-center gap-2 text-label-caps transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          Teams
        </Link>
        <div className="flex items-center gap-3">
          <button
            id="note-payment-team-btn"
            onClick={() => setPaymentModalOpen(true)}
            className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary-fixed)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>payments</span>
            Note Payment
          </button>
          {paymentSummary && paymentSummary.pending > 0 && (
            <button
              id="settle-team-btn"
              onClick={() => setConfirmSettle(true)}
              className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
              Settle {formatCurrency(paymentSummary.pending)}
            </button>
          )}
          <button id="edit-team-btn" onClick={() => setEditOpen(true)}
            className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
            Edit Team
          </button>
          <button id="delete-team-btn" onClick={() => setConfirmDelete(true)}
            className="h-10 px-4 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
          </button>
        </div>
      </header>

      <div className="px-4 md:px-[var(--spacing-container-margin)] py-8 flex flex-col gap-8">
        {/* Team Profile Card */}
        <div className="rounded-xl p-8 relative overflow-hidden"
          style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5"
            style={{ backgroundColor: "var(--color-primary)", transform: "translate(30%, -30%)" }} />

          <div className="flex items-start gap-6 mb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0 avatar-hover"
              style={{ backgroundColor: "var(--color-secondary-container)", color: "var(--color-on-secondary-fixed)" }}>
              {getInitials(team.name)}
            </div>
            <div>
              <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)" }}>{team.name}</h1>
              {team.description && (
                <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{team.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: team.status === "active" ? "#2d7a4f" : "var(--color-outline)" }} />
                <span className="text-body-md font-medium"
                  style={{ color: team.status === "active" ? "#2d7a4f" : "var(--color-on-surface-variant)" }}>
                  {team.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Wage Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6"
            style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>payments</span>
                Daily Wage / Person
              </p>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(team.daily_wage)}/person
              </p>
            </div>
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>directions_car</span>
                Car Rent
              </p>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(team.car_rent)}/day
              </p>
            </div>
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>manage_accounts</span>
                Manager Fee
              </p>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(team.manager_fee)}/day
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        {history.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>Times Present</p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>{presentRecords.length}</p>
            </div>
            <div className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>Total Paid</p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>{formatCurrency(totalEarned)}</p>
            </div>
          </div>
        )}

        {/* Attendance History */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Attendance History</h2>
            {history.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)}
                  className="h-8 px-2 rounded-lg text-label-caps"
                  style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)",
                    color: historyFrom ? "var(--color-on-surface)" : "var(--color-outline)", outline: "none", colorScheme: "dark" }} />
                <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>to</span>
                <input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)}
                  className="h-8 px-2 rounded-lg text-label-caps"
                  style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)",
                    color: historyTo ? "var(--color-on-surface)" : "var(--color-outline)", outline: "none", colorScheme: "dark" }} />
                {(historyFrom || historyTo) && (
                  <button onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}
                    className="h-8 px-2 rounded-lg text-label-caps flex items-center gap-1"
                    style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>close</span>Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }} />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>history</span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>No attendance records yet.</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-xl p-6 text-center"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>No records in selected date range.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
              <div style={{ overflowX: "auto" }}>
                <div className="grid px-5 py-3"
                  style={{
                    gridTemplateColumns: "110px 80px 70px 1fr 80px 90px",
                    borderBottom: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-low)",
                    minWidth: "500px",
                  }}>
                  {["Date", "Status", "Workers", "Task", "Time", "Amount"].map(h => (
                    <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{h}</p>
                  ))}
                </div>
                {filteredHistory.map((rec, idx) => (
                  <div key={rec.id} className="grid items-center px-5 py-3"
                    style={{
                      gridTemplateColumns: "110px 80px 70px 1fr 80px 90px",
                      borderBottom: idx < filteredHistory.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                      minWidth: "500px",
                    }}>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface)" }}>
                      {new Date(rec.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    <span className="text-label-caps font-semibold"
                      style={{ color: rec.status === "present" ? "#2d7a4f" : "var(--color-tertiary)" }}>
                      {rec.status === "present" ? "Present" : "Absent"}
                    </span>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                      {rec.num_labourers ?? "—"}
                    </p>
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
            </div>
          )}
        </section>

        {/* Contract History */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Contract History</h2>
            {contracts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={contractFrom} onChange={e => setContractFrom(e.target.value)}
                  className="h-8 px-2 rounded-lg text-label-caps"
                  style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)",
                    color: contractFrom ? "var(--color-on-surface)" : "var(--color-outline)", outline: "none", colorScheme: "dark" }} />
                <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>to</span>
                <input type="date" value={contractTo} onChange={e => setContractTo(e.target.value)}
                  className="h-8 px-2 rounded-lg text-label-caps"
                  style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)",
                    color: contractTo ? "var(--color-on-surface)" : "var(--color-outline)", outline: "none", colorScheme: "dark" }} />
                {(contractFrom || contractTo) && (
                  <button onClick={() => { setContractFrom(""); setContractTo(""); }}
                    className="h-8 px-2 rounded-lg text-label-caps flex items-center gap-1"
                    style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>close</span>Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {contractsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }} />
            </div>
          ) : contracts.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>description</span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>No contracts assigned yet.</p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="rounded-xl p-6 text-center"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>No contracts in selected date range.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
              <div style={{ overflowX: "auto" }}>
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
                {filteredContracts.map((c, idx) => {
                  const sc = contractStatusColor(c.status);
                  return (
                    <div key={c.id} className="grid items-center px-5 py-3"
                      style={{
                        gridTemplateColumns: "minmax(160px,2fr) 110px minmax(90px,1fr) 80px",
                        borderBottom: idx < filteredContracts.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
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

        {/* Payment History */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>Payment History</h2>
            <div className="flex gap-2">
              {paymentSummary && paymentSummary.pending > 0 && (
                <button
                  onClick={() => setConfirmSettle(true)}
                  className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                  Settle {formatCurrency(paymentSummary.pending)}
                </button>
              )}
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                Note Payment
              </button>
            </div>
          </div>

          {paymentSummary && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl px-4 py-3"
                style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
                <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>Total Earned</p>
                <p className="text-body-lg font-bold" style={{ color: "var(--color-on-surface)" }}>
                  {formatCurrency(paymentSummary.total_earned)}
                </p>
              </div>
              <div className="rounded-xl px-4 py-3"
                style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
                <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>Total Paid</p>
                <p className="text-body-lg font-bold" style={{ color: "#2d7a4f" }}>
                  {formatCurrency(paymentSummary.total_paid)}
                </p>
              </div>
              <div className="rounded-xl px-4 py-3"
                style={{
                  backgroundColor: paymentSummary.pending > 0 ? "rgba(255,218,211,0.3)" : "rgba(193,236,212,0.3)",
                  border: `1px solid ${paymentSummary.pending > 0 ? "rgba(220,53,69,0.2)" : "rgba(45,122,79,0.2)"}`,
                }}>
                <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>Outstanding</p>
                <p className="text-body-lg font-bold" style={{ color: paymentSummary.pending > 0 ? "var(--color-error)" : "#2d7a4f" }}>
                  {formatCurrency(Math.max(0, paymentSummary.pending))}
                </p>
              </div>
            </div>
          )}

          {paymentsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }} />
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>receipt_long</span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>No payments recorded yet.</p>
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="h-9 px-4 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                Record First Payment
              </button>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
              <div className="grid px-5 py-3"
                style={{
                  gridTemplateColumns: "110px 1fr 90px 100px",
                  borderBottom: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-low)",
                }}>
                {["Date", "Notes", "Mode", "Amount"].map(h => (
                  <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{h}</p>
                ))}
              </div>
              {payments.map((p, idx) => (
                <div key={p.id} className="grid items-center px-5 py-3"
                  style={{
                    gridTemplateColumns: "110px 1fr 90px 100px",
                    borderBottom: idx < payments.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                  }}>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface)" }}>
                    {formatMediumDate(p.date)}
                  </p>
                  <p className="text-body-md truncate pr-3" style={{ color: "var(--color-on-surface-variant)" }}>
                    {p.notes || "\u2014"}
                  </p>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    {p.method === "bank_transfer" ? "Bank" : p.method.charAt(0).toUpperCase() + p.method.slice(1)}
                  </p>
                  <p className="text-body-md font-semibold" style={{ color: "#2d7a4f" }}>
                    {formatCurrency(p.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
