"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiFetch } from "@/lib/api";
import { Team, EntityPaymentSummary, PaymentRead, PaginatedPayments } from "@/types";
import { formatCurrency, formatMediumDate, getInitials } from "@/lib/utils";
import TeamModal from "@/components/TeamModal";
import PaymentModal from "@/components/PaymentModal";
import DatePicker from "@/components/ui/DatePicker";
import { useLanguage } from "@/context/LanguageContext";

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
  wage_type?: string;
  contract?: { id: string; title: string; amount: number } | null;
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
  const { t } = useLanguage();

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

  // History tab
  const [activeTab, setActiveTab] = useState<"attendance" | "contracts" | "payments">("attendance");

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
        setError(t("teams.somethingWentWrong"));
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
      setDeleteError(t("teams.genericError"));
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
      setSettleError(t("teams.genericError"));
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
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.loadingTeam")}</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)" }}>group_off</span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{t("teams.teamNotFound")}</p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          {t("teams.teamNotFoundMessage")}
        </p>
        <Link href="/teams" className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
          {t("teams.backToTeams")}
        </Link>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-error)" }}>error_outline</span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{t("teams.somethingWentWrong")}</p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{error}</p>
        <button onClick={fetchTeam} className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
          {t("common.retry")}
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
                <h2 className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>{t("teams.settleBalance")}</h2>
                <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.forLabel")} {team?.name}</p>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div
                  className="rounded-xl px-5 py-4 flex flex-col gap-3"
                  style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}
                >
                  <div className="flex justify-between">
                    <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.totalEarned")}</span>
                    <span className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>{formatCurrency(paymentSummary.total_earned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.totalPaid")}</span>
                    <span className="text-body-md font-semibold" style={{ color: "#2d7a4f" }}>{formatCurrency(paymentSummary.total_paid)}</span>
                  </div>
                  <div className="flex justify-between pt-3" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
                    <span className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>{t("teams.outstanding")}</span>
                    <span className="text-body-md font-bold" style={{ color: "var(--color-error)" }}>{formatCurrency(paymentSummary.pending)}</span>
                  </div>
                </div>
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  {t("teams.settleConfirmPrefix")}{" "}
                  <strong style={{ color: "var(--color-on-surface)" }}>{formatCurrency(paymentSummary.pending)}</strong>{" "}
                  {t("teams.settleConfirmSuffix")}
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
                  {t("common.cancel")}
                </button>
                <button
                  id="settle-confirm-btn"
                  onClick={handleSettle}
                  disabled={settling}
                  className="flex-1 h-11 rounded-xl text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                >
                  {settling ? t("teams.settling") : `${t("teams.settle")} ${formatCurrency(paymentSummary.pending)}`}
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
                    {t("teams.deleteQuestion")} {team.name}?
                  </p>
                  <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                    {t("teams.deletePermanentlyWarning")}
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
                  {t("common.cancel")}
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-error)", color: "#fff" }}>
                  {deleting ? t("teams.deleting") : t("teams.deletePermanently")}
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
          {t("teams.teamsLink")}
        </Link>
        <div className="flex items-center gap-3">
          <button
            id="note-payment-team-btn"
            onClick={() => setPaymentModalOpen(true)}
            className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary-fixed)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>payments</span>
            {t("teams.notePayment")}
          </button>
          {paymentSummary && paymentSummary.pending > 0 && (
            <button
              id="settle-team-btn"
              onClick={() => setConfirmSettle(true)}
              className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
              {t("teams.settle")} {formatCurrency(paymentSummary.pending)}
            </button>
          )}
          <button id="edit-team-btn" onClick={() => setEditOpen(true)}
            className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
            {t("teams.editTeam")}
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
              {team.hometown && (
                <p className="text-body-md mt-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>location_on</span>
                  {team.hometown}
                </p>
              )}
              {team.description && (
                <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{team.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: team.status === "active" ? "#2d7a4f" : "var(--color-outline)" }} />
                <span className="text-body-md font-medium"
                  style={{ color: team.status === "active" ? "#2d7a4f" : "var(--color-on-surface-variant)" }}>
                  {team.status === "active" ? t("common.active") : t("common.inactive")}
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
                {t("teams.dailyWagePerPerson")}
              </p>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(team.daily_wage)}{t("teams.perPerson")}
              </p>
            </div>
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>directions_car</span>
                {t("teams.carRent")}
              </p>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(team.car_rent)}{t("teams.perDay")}
              </p>
            </div>
            <div>
              <p className="text-label-caps mb-1 flex items-center gap-1" style={{ color: "var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>manage_accounts</span>
                {t("teams.managerFee")}
              </p>
              <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(team.manager_fee)}{t("teams.perDay")}
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        {history.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.timesPresent")}</p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>{presentRecords.length}</p>
            </div>
            <div className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.totalPaid")}</p>
              <p className="text-display-currency" style={{ color: "var(--color-on-surface)" }}>{formatCurrency(totalEarned)}</p>
            </div>
          </div>
        )}

        {/* Tabbed History Section */}
        <div className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>

          {/* Tab Bar */}
          <div className="flex"
            style={{ borderBottom: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)" }}>
            {(
              [
                { key: "attendance", icon: "history", label: t("teams.attendanceHistory"), count: history.length },
                { key: "contracts",  icon: "description", label: t("teams.contractHistory"), count: contracts.length },
                { key: "payments",   icon: "receipt_long", label: t("teams.paymentHistory"), count: payments.length },
              ] as { key: "attendance" | "contracts" | "payments"; icon: string; label: string; count: number }[]
            ).map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-label-caps transition-colors relative"
                  style={{ color: isActive ? "var(--color-primary)" : "var(--color-on-surface-variant)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className="text-label-caps px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isActive ? "var(--color-primary-container)" : "var(--color-surface-container)",
                        color: isActive ? "var(--color-on-primary-container)" : "var(--color-on-surface-variant)",
                        fontSize: "10px",
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Panels */}
          <div className="p-5 overflow-y-auto" style={{ height: "22rem" }}>

            {/* ── Attendance ── */}
            {activeTab === "attendance" && (
              <div key="attendance" className="tab-panel-enter">
                {history.length > 0 && (
                  <div className="flex items-center justify-end gap-2 flex-wrap mb-4">
                    <DatePicker value={historyFrom} onChange={setHistoryFrom} />
                    <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>{t("common.to")}</span>
                    <DatePicker value={historyTo} onChange={setHistoryTo} />
                    {(historyFrom || historyTo) && (
                      <button onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}
                        className="h-8 px-2 rounded-lg text-label-caps flex items-center gap-1"
                        style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>close</span>{t("common.clear")}
                      </button>
                    )}
                  </div>
                )}

                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--color-primary)" }} />
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>history</span>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.noAttendanceRecords")}</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.noRecordsInRange")}</p>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--color-outline-variant)" }}>
                    <div style={{ overflowX: "auto" }}>
                      <div className="grid px-5 py-3"
                        style={{
                          gridTemplateColumns: "110px 80px 70px 1fr 80px 90px",
                          borderBottom: "1px solid var(--color-outline-variant)",
                          backgroundColor: "var(--color-surface-container-low)",
                          minWidth: "500px",
                        }}>
                        {[t("common.date"), t("common.status"), t("teams.colWorkers"), t("teams.colTask"), t("teams.colTime"), t("common.amount")].map(h => (
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
                            {rec.status === "present" ? t("teams.present") : t("teams.absent")}
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
                          {rec.wage_type === "contract" ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="px-1.5 py-0.5 rounded text-label-caps font-semibold" style={{ backgroundColor: "#fef9c3", color: "#92400e" }}>CONTRACT</span>
                              {rec.contract && <p className="text-label-caps truncate max-w-[90px]" style={{ color: "#92400e" }}>{rec.contract.title}</p>}
                            </div>
                          ) : (
                            <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                              {rec.wage_earned > 0 ? formatCurrency(rec.wage_earned) : "—"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Contracts ── */}
            {activeTab === "contracts" && (
              <div key="contracts" className="tab-panel-enter">
                {contracts.length > 0 && (
                  <div className="flex items-center justify-end gap-2 flex-wrap mb-4">
                    <DatePicker value={contractFrom} onChange={setContractFrom} />
                    <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>{t("common.to")}</span>
                    <DatePicker value={contractTo} onChange={setContractTo} />
                    {(contractFrom || contractTo) && (
                      <button onClick={() => { setContractFrom(""); setContractTo(""); }}
                        className="h-8 px-2 rounded-lg text-label-caps flex items-center gap-1"
                        style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>close</span>{t("common.clear")}
                      </button>
                    )}
                  </div>
                )}

                {contractsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--color-primary)" }} />
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>description</span>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.noContractsYet")}</p>
                  </div>
                ) : filteredContracts.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.noContractsInRange")}</p>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--color-outline-variant)" }}>
                    <div style={{ overflowX: "auto" }}>
                      <div className="grid px-5 py-3"
                        style={{
                          gridTemplateColumns: "minmax(160px,2fr) 110px minmax(90px,1fr) 80px",
                          borderBottom: "1px solid var(--color-outline-variant)",
                          backgroundColor: "var(--color-surface-container-low)",
                          minWidth: "400px",
                        }}>
                        {[t("teams.colWorkTitle"), t("teams.colAssigned"), t("common.amount"), t("common.status")].map(h => (
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
              </div>
            )}

            {/* ── Payments ── */}
            {activeTab === "payments" && (
              <div key="payments" className="tab-panel-enter">
                <div className="flex items-center justify-end gap-2 flex-wrap mb-4">
                  {paymentSummary && paymentSummary.pending > 0 && (
                    <button
                      onClick={() => setConfirmSettle(true)}
                      className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                      {t("teams.settle")} {formatCurrency(paymentSummary.pending)}
                    </button>
                  )}
                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                    {t("teams.notePayment")}
                  </button>
                </div>

                {paymentSummary && (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="rounded-xl px-4 py-3"
                      style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}>
                      <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>{t("teams.totalEarned")}</p>
                      <p className="text-body-lg font-bold" style={{ color: "var(--color-on-surface)" }}>
                        {formatCurrency(paymentSummary.total_earned)}
                      </p>
                    </div>
                    <div className="rounded-xl px-4 py-3"
                      style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}>
                      <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>{t("teams.totalPaid")}</p>
                      <p className="text-body-lg font-bold" style={{ color: "#2d7a4f" }}>
                        {formatCurrency(paymentSummary.total_paid)}
                      </p>
                    </div>
                    <div className="rounded-xl px-4 py-3"
                      style={{
                        backgroundColor: paymentSummary.pending > 0 ? "rgba(255,218,211,0.3)" : "rgba(193,236,212,0.3)",
                        border: `1px solid ${paymentSummary.pending > 0 ? "rgba(220,53,69,0.2)" : "rgba(45,122,79,0.2)"}`,
                      }}>
                      <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>{t("teams.outstanding")}</p>
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
                  <div className="py-10 flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)" }}>receipt_long</span>
                    <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("teams.noPaymentsYet")}</p>
                    <button
                      onClick={() => setPaymentModalOpen(true)}
                      className="h-9 px-4 rounded-lg text-body-md font-semibold"
                      style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                    >
                      {t("teams.recordFirstPayment")}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--color-outline-variant)" }}>
                    <div className="grid px-5 py-3"
                      style={{
                        gridTemplateColumns: "110px 1fr 90px 100px",
                        borderBottom: "1px solid var(--color-outline-variant)",
                        backgroundColor: "var(--color-surface-container-low)",
                      }}>
                      {[t("common.date"), t("teams.colNotes"), t("teams.colMode"), t("common.amount")].map(h => (
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
                          {p.method === "bank_transfer" ? t("teams.bankMethod") : p.method.charAt(0).toUpperCase() + p.method.slice(1)}
                        </p>
                        <p className="text-body-md font-semibold" style={{ color: "#2d7a4f" }}>
                          {formatCurrency(p.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
