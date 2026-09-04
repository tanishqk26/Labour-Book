"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Labour {
  id: string;
  name: string;
  daily_wage: number;
}

interface TeamSummary {
  id: string;
  name: string;
  daily_wage: number;
}

interface PlotSummary {
  id: string;
  name: string;
  size_acres: number;
  crop_name?: string;
}

interface Contract {
  id: string;
  title: string;
  description?: string;
  entity_type: "individual" | "team";
  labour_id?: string;
  team_id?: string;
  entity_name?: string;
  plot_id?: string;
  plot?: PlotSummary;
  amount_per_acre?: number;
  amount: number;
  assigned_date: string;
  completed_date?: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

interface PaginatedContracts {
  items: Contract[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

type StatusFilter = "all" | "active" | "completed" | "cancelled";

// ---------------------------------------------------------------------------
// Agricultural year helpers (April → March)
// ---------------------------------------------------------------------------

/** Returns { label, from, to } for April-to-March agricultural years */
function getAgriYears(): { label: string; from: string; to: string }[] {
  const result: { label: string; from: string; to: string }[] = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-based
  const latestStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  for (let y = 2022; y <= latestStart; y++) {
    result.push({
      label: `${y}-${String(y + 1).slice(2)}`,
      from: `${y}-04-01`,
      to: `${y + 1}-03-31`,
    });
  }
  return result.reverse(); // newest first
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusColor(status: string) {
  if (status === "active") return { bg: "#c1ecd4", text: "#012d1d" };
  if (status === "completed") return { bg: "#d7e4f0", text: "#111d25" };
  return { bg: "#ffdad3", text: "#510900" }; // cancelled
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ---------------------------------------------------------------------------
// Contract Form Modal
// ---------------------------------------------------------------------------

interface ContractFormProps {
  labours: Labour[];
  teams: TeamSummary[];
  plots: PlotSummary[];
  contract?: Contract; // if editing
  onSaved: () => void;
  onClose: () => void;
}

function ContractForm({ labours, teams, plots, contract, onSaved, onClose }: ContractFormProps) {
  const isEdit = !!contract;

  const [title, setTitle] = useState(contract?.title ?? "");
  const [description, setDescription] = useState(contract?.description ?? "");
  const [entityType, setEntityType] = useState<"individual" | "team">(
    contract?.entity_type ?? "individual"
  );
  const [labourId, setLabourId] = useState(contract?.labour_id ?? "");
  const [teamId, setTeamId] = useState(contract?.team_id ?? "");
  // Plot fields (only on create)
  const [plotId, setPlotId] = useState("");
  const [amountPerAcre, setAmountPerAcre] = useState("");
  const [amount, setAmount] = useState(contract?.amount ? String(contract.amount) : "");
  const [assignedDate, setAssignedDate] = useState(
    contract?.assigned_date ?? new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<"active" | "completed" | "cancelled">(
    contract?.status ?? "active"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate amount when plot + rate per acre changes
  const selectedPlot = plots.find(p => p.id === plotId);
  const calculatedAmount = selectedPlot && amountPerAcre && Number(amountPerAcre) > 0
    ? Number(amountPerAcre) * selectedPlot.size_acres
    : null;

  // Sync amount field from calculation
  useEffect(() => {
    if (calculatedAmount !== null) {
      setAmount(String(calculatedAmount));
    }
  }, [calculatedAmount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!amount || Number(amount) <= 0) { setError("Amount must be greater than 0."); return; }
    if (entityType === "individual" && !labourId) { setError("Select a labourer."); return; }
    if (entityType === "team" && !teamId) { setError("Select a team."); return; }

    setSubmitting(true);
    setError(null);

    try {
      if (isEdit) {
        await apiPatch(`/api/v1/contracts/${contract!.id}`, {
          title: title.trim(),
          description: description.trim() || null,
          amount: Number(amount),
          assigned_date: assignedDate,
          status,
        });
      } else {
        await apiPost("/api/v1/contracts", {
          title: title.trim(),
          description: description.trim() || null,
          entity_type: entityType,
          labour_id: entityType === "individual" ? labourId : undefined,
          team_id: entityType === "team" ? teamId : undefined,
          plot_id: plotId || undefined,
          amount_per_acre: plotId && amountPerAcre ? Number(amountPerAcre) : undefined,
          amount: Number(amount),
          assigned_date: assignedDate,
          status,
        });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setError(typeof data?.detail === "string" ? data.detail : "Failed to save contract.");
      } else {
        setError("Network error. Try again.");
      }
      setSubmitting(false);
    }
  }

  const inputStyle = {
    border: "1px solid var(--color-outline-variant)",
    backgroundColor: "var(--color-surface-container-lowest)",
    color: "var(--color-on-surface)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: "none" }}>
        <div
          className="flex flex-col shadow-2xl w-full"
          style={{
            maxWidth: "480px",
            maxHeight: "90vh",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-outline-variant)",
            borderRadius: "var(--radius-lg)",
            pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
          >
            <h2 className="text-headline-md" style={{ color: "var(--color-primary)" }}>
              {isEdit ? "Edit Contract" : "New Contract"}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {error && (
              <p className="text-label-caps px-4 py-2 rounded-lg" style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-error)" }}>
                {error}
              </p>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Work Description *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Grape pruning — Plot 2"
                className="h-11 px-3 rounded-lg text-body-md"
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Notes (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any additional details..."
                rows={1}
                className="px-3 py-2 rounded-lg text-body-md resize-none"
                style={{ ...inputStyle, height: "52px" }}
              />
            </div>

            {/* Entity type — only selectable on create */}
            {!isEdit && (
              <div className="flex flex-col gap-1">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  Assign To *
                </label>
                <div className="flex gap-2">
                  {(["individual", "team"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEntityType(t)}
                      className="flex-1 h-10 rounded-lg text-body-md font-semibold transition-all"
                      style={{
                        backgroundColor: entityType === t ? "var(--color-primary)" : "var(--color-surface-container)",
                        color: entityType === t ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                        border: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      {t === "individual" ? "Individual Labour" : "Labour Team"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Labour or Team selector */}
            {!isEdit && entityType === "individual" && (
              <div className="flex flex-col gap-1">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  Labourer *
                </label>
                <select
                  value={labourId}
                  onChange={(e) => setLabourId(e.target.value)}
                  className="h-11 px-3 rounded-lg text-body-md"
                  style={inputStyle}
                >
                  <option value="">Select labourer…</option>
                  {labours.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!isEdit && entityType === "team" && (
              <div className="flex flex-col gap-1">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  Team *
                </label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="h-11 px-3 rounded-lg text-body-md"
                  style={inputStyle}
                >
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Plot selection — only on create */}
            {!isEdit && (
              <div className="flex flex-col gap-1">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  Plot (optional)
                </label>
                <select
                  value={plotId}
                  onChange={e => { setPlotId(e.target.value); if (!e.target.value) { setAmountPerAcre(""); } }}
                  className="h-11 px-3 rounded-lg text-body-md"
                  style={inputStyle}
                >
                  <option value="">No plot selected</option>
                  {plots.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.size_acres} acres{p.crop_name ? ` (${p.crop_name})` : ""}
                    </option>
                  ))}
                </select>

                {/* Rate per acre — only shows when a plot is selected */}
                {plotId && (
                  <div className="flex flex-col gap-1 mt-2">
                    <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                      Rate per Acre (₹) *
                    </label>
                    <input
                      type="number"
                      value={amountPerAcre}
                      onChange={e => setAmountPerAcre(e.target.value)}
                      placeholder="e.g. 5000"
                      min={1}
                      className="h-11 px-3 rounded-lg text-body-md"
                      style={inputStyle}
                    />
                    {/* Live calculation preview */}
                    {calculatedAmount !== null && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
                        style={{ backgroundColor: "var(--color-primary-fixed)", border: "1px solid var(--color-primary-fixed-dim)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-primary)" }}>calculate</span>
                        <p className="text-label-caps" style={{ color: "var(--color-on-primary-fixed)" }}>
                          {amountPerAcre} × {selectedPlot?.size_acres} acres = <strong>{formatCurrency(calculatedAmount)}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                {plotId ? "Total Amount (₹) — auto-calculated" : "Agreed Amount (₹) *"}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 25000"
                min={1}
                readOnly={!!calculatedAmount}
                className="h-11 px-3 rounded-lg text-body-md"
                style={{ ...inputStyle, opacity: calculatedAmount ? 0.75 : 1, cursor: calculatedAmount ? "not-allowed" : "text" }}
              />
              <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)", opacity: 0.7 }}>
                {plotId ? "Calculated from rate × plot size. Edit the rate above to change." : "Fixed amount, independent of daily wages."}
              </p>
            </div>

            {/* Assigned Date */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Assignment Date *
              </label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="h-11 px-3 rounded-lg text-body-md"
                style={inputStyle}
              />
            </div>

            {/* Status — always editable */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Status
              </label>
              <div className="flex gap-2">
                {(["active", "completed", "cancelled"] as const).map((s) => {
                  const colors = statusColor(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className="flex-1 h-9 rounded-lg text-label-caps font-semibold transition-all"
                      style={{
                        backgroundColor: status === s ? colors.bg : "var(--color-surface-container)",
                        color: status === s ? colors.text : "var(--color-on-surface-variant)",
                        border: `1px solid ${status === s ? colors.bg : "var(--color-outline-variant)"}`,
                        fontWeight: status === s ? 700 : 400,
                      }}
                    >
                      {statusLabel(s)}
                    </button>
                  );
                })}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div
            className="px-6 py-4 flex gap-3 flex-shrink-0"
            style={{ borderTop: "1px solid var(--color-outline-variant)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-body-md font-semibold"
              style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={submitting}
              className="flex-1 h-11 rounded-xl text-body-md font-semibold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "white" }} />
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>save</span>
                  {isEdit ? "Save Changes" : "Create Contract"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Contract Card
// ---------------------------------------------------------------------------

function ContractCard({
  contract,
  onEdit,
  onDelete,
  onStatusChanged,
}: {
  contract: Contract;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChanged: (id: string, status: Contract["status"]) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const colors = statusColor(contract.status);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/api/v1/contracts/${contract.id}`);
      onDelete();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleStatusChange(newStatus: Contract["status"]) {
    if (newStatus === contract.status) return;
    setUpdatingStatus(newStatus);
    try {
      await apiPatch(`/api/v1/contracts/${contract.id}`, { status: newStatus });
      onStatusChanged(contract.id, newStatus);
    } catch {
      // silent fail — user can retry
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 relative card-hover"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-5 text-center"
          style={{ backgroundColor: "var(--color-error-container)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-error)" }}>
            delete_forever
          </span>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-error-container)" }}>
            Delete this contract?
          </p>
          <p className="text-label-caps" style={{ color: "var(--color-on-error-container)", opacity: 0.8 }}>
            This action cannot be undone.
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold"
              style={{ border: "1px solid var(--color-on-error-container)", color: "var(--color-on-error-container)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--color-error)", color: "var(--color-on-error)" }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-body-lg font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
            {contract.title}
          </h3>
          <p className="text-label-caps mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>
            {contract.entity_name ?? (contract.entity_type === "team" ? "Team" : "Labour")}
            {" · "}
            {contract.entity_type === "team" ? "Team" : "Individual"}
          </p>
        </div>
        {/* Edit + Delete */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
            aria-label="Edit contract"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ border: "1px solid var(--color-error)", color: "var(--color-error)" }}
            aria-label="Delete contract"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
          </button>
        </div>
      </div>

      {/* Description */}
      {contract.description && (
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          {contract.description}
        </p>
      )}

      {/* Amount + Date */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <div>
          <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
            Agreed Amount
          </p>
          <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>
            {formatCurrency(contract.amount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
            Assigned
          </p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {formatDate(contract.assigned_date)}
          </p>
        </div>
      </div>

      {/* Inline Status Toggle */}
      <div
        className="pt-3 flex flex-col gap-2"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Status</p>
        <div className="flex gap-1.5">
          {(["active", "completed", "cancelled"] as const).map((s) => {
            const sc = statusColor(s);
            const isActive = contract.status === s;
            const isLoading = updatingStatus === s;
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={isLoading || updatingStatus !== null}
                className="flex-1 h-8 rounded-lg text-label-caps font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-60 hover-grow"
                style={{
                  backgroundColor: isActive ? sc.bg : "var(--color-surface-container)",
                  color: isActive ? sc.text : "var(--color-on-surface-variant)",
                  border: `1px solid ${isActive ? sc.bg : "var(--color-outline-variant)"}`,
                  fontWeight: isActive ? 700 : 500,
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              >
                {isLoading ? (
                  <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "currentColor" }} />
                ) : (
                  statusLabel(s)
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // New filters (client-side)
  const [plotFilter, setPlotFilter] = useState("");       // plot id
  const [dateFilter, setDateFilter] = useState("");       // ISO date
  const [yearFilter, setYearFilter] = useState("");       // "2024-25" label
  const [showFilters, setShowFilters] = useState(false);

  const allAgriYears = getAgriYears();

  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [plots, setPlots] = useState<PlotSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);

  const PAGE_SIZE = 20;

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await apiGet<PaginatedContracts>("/api/v1/contracts", params);
      setContracts(data.items);
      setTotal(data.total);
    } catch {
      setError("Failed to load contracts.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  // Load labours + teams + plots once for the form
  useEffect(() => {
    Promise.all([
      apiGet<{ items: Labour[] }>("/api/v1/labours?status=active&page_size=100"),
      apiGet<{ items: TeamSummary[] }>("/api/v1/teams?status=active&page_size=100"),
      apiGet<{ items: PlotSummary[] }>("/api/v1/plots?status=active&page_size=100"),
    ]).then(([l, t, p]) => {
      setLabours(l.items);
      setTeams(t.items);
      setPlots(p.items);
    }).catch(() => {});
  }, []);

  function handleStatusChanged(id: string, newStatus: Contract["status"]) {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );
  }

  function openCreate() {
    setEditingContract(undefined);
    setShowForm(true);
  }

  function openEdit(c: Contract) {
    setEditingContract(c);
    setShowForm(true);
  }

  function handleSaved() {
    setShowForm(false);
    fetchContracts();
  }

  // Client-side filter application
  const selectedYear = allAgriYears.find(y => y.label === yearFilter);
  const displayedContracts = contracts.filter((c) => {
    if (plotFilter && c.plot_id !== plotFilter) return false;
    if (dateFilter && c.assigned_date !== dateFilter) return false;
    if (selectedYear) {
      if (c.assigned_date < selectedYear.from || c.assigned_date > selectedYear.to) return false;
    }
    return true;
  });

  const activeFilterCount =
    (plotFilter ? 1 : 0) + (dateFilter ? 1 : 0) + (yearFilter ? 1 : 0);

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const totalAmount = displayedContracts.reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <title>Contracts | LabourBook</title>

      {showForm && (
        <ContractForm
          labours={labours}
          teams={teams}
          plots={plots}
          contract={editingContract}
          onSaved={handleSaved}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        {/* Page Header */}
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>
              CONTRACTS
            </p>
            <h1
              className="text-headline-lg"
              style={{ color: "var(--color-on-surface)", fontSize: "clamp(24px, 5vw, 32px)" }}
            >
              Contract Work
            </h1>
            <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
              Fixed-price work assigned to labourers or teams.
            </p>
          </div>
          <button
            id="new-contract-btn"
            onClick={openCreate}
            className="h-12 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap self-start sm:self-auto"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            New Contract
          </button>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-6">

          {/* Summary strip */}
          {!loading && displayedContracts.length > 0 && (
            <div
              className="px-5 py-4 rounded-xl flex items-center gap-6 flex-wrap"
              style={{
                backgroundColor: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <div>
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  {statusFilter === "all" ? "Showing" : statusLabel(statusFilter)} Contracts
                </p>
                <p className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>
                  {displayedContracts.length}
                </p>
              </div>
              <div className="w-px h-10 self-center" style={{ backgroundColor: "var(--color-outline-variant)" }} />
              <div>
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Total Value</p>
                <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>
                  {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>
          )}

          {/* ── Filter bar ── */}
          <div
            className="rounded-xl flex flex-col gap-3 p-4"
            style={{
              backgroundColor: "var(--color-surface-container-lowest)",
              border: "1px solid var(--color-outline-variant)",
            }}
          >
            {/* Row 1: status chips + expand toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {filterButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setStatusFilter(btn.key)}
                  className="h-8 px-3 rounded-full text-body-md font-semibold flex items-center gap-1 transition-all"
                  style={{
                    backgroundColor: statusFilter === btn.key ? "var(--color-primary)" : "var(--color-surface-container-low)",
                    color: statusFilter === btn.key ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    border: statusFilter === btn.key ? "none" : "1px solid var(--color-outline-variant)",
                  }}
                >
                  {btn.label}
                </button>
              ))}
              <button
                onClick={() => setShowFilters(f => !f)}
                className="ml-auto h-8 px-3 rounded-full text-body-md font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  backgroundColor: (showFilters || activeFilterCount > 0) ? "var(--color-secondary-container)" : "var(--color-surface-container-low)",
                  color: (showFilters || activeFilterCount > 0) ? "var(--color-on-secondary-fixed)" : "var(--color-on-surface-variant)",
                  border: "1px solid var(--color-outline-variant)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>filter_list</span>
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full text-label-caps flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setPlotFilter(""); setDateFilter(""); setYearFilter(""); }}
                  className="h-8 px-2 rounded-full text-label-caps flex items-center gap-1"
                  style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                  Clear
                </button>
              )}
            </div>

            {/* Row 2: expanded filter options */}
            {showFilters && (
              <div className="flex flex-col gap-3 pt-2" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>

                {/* Plot filter */}
                {plots.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Plot</label>
                    <select
                      value={plotFilter}
                      onChange={e => setPlotFilter(e.target.value)}
                      className="h-10 px-3 rounded-lg text-body-md"
                      style={{
                        backgroundColor: "var(--color-surface-container-low)",
                        border: "1px solid var(--color-outline-variant)",
                        color: "var(--color-on-surface)",
                        outline: "none",
                      }}
                    >
                      <option value="">All plots</option>
                      {plots.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.crop_name ? ` (${p.crop_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date filter */}
                <div className="flex flex-col gap-1">
                  <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Specific Date</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="contract-date-filter"
                      type="date"
                      value={dateFilter}
                      onChange={e => { setDateFilter(e.target.value); setYearFilter(""); }}
                      className="h-10 px-3 rounded-lg text-body-md flex-1"
                      style={{
                        backgroundColor: "var(--color-surface-container-low)",
                        border: "1px solid var(--color-outline-variant)",
                        color: dateFilter ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                        outline: "none",
                        colorScheme: "dark",
                      }}
                    />
                    {dateFilter && (
                      <button onClick={() => setDateFilter("")} className="h-10 px-3 rounded-lg"
                        style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Year filter (April-March) */}
                <div className="flex flex-col gap-1">
                  <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Agricultural Year (Apr – Mar)</label>
                  <div className="flex flex-wrap gap-2">
                    {allAgriYears.map(yr => (
                      <button
                        key={yr.label}
                        onClick={() => { setYearFilter(v => v === yr.label ? "" : yr.label); setDateFilter(""); }}
                        className="h-8 px-3 rounded-full text-label-caps font-semibold transition-all"
                        style={{
                          backgroundColor: yearFilter === yr.label ? "var(--color-primary)" : "var(--color-surface-container-low)",
                          color: yearFilter === yr.label ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                          border: yearFilter === yr.label ? "none" : "1px solid var(--color-outline-variant)",
                        }}
                      >
                        {yr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              className="py-6 px-5 rounded-xl text-center"
              style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}
            >
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button
                onClick={fetchContracts}
                className="px-5 py-2 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }}
              />
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && displayedContracts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)" }}>description</span>
              <div className="text-center">
                <p className="text-headline-md mb-1" style={{ color: "var(--color-on-surface)" }}>
                  {activeFilterCount > 0 ? "No contracts match filters" : statusFilter !== "all" ? `No ${statusFilter} contracts` : "No contracts yet"}
                </p>
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  {activeFilterCount > 0
                    ? "Try adjusting or clearing the filters above."
                    : statusFilter !== "all"
                    ? "Try changing the filter above."
                    : "Create your first contract to track fixed-price work."}
                </p>
              </div>
              {statusFilter === "all" && activeFilterCount === 0 && (
                <button
                  onClick={openCreate}
                  className="mt-2 h-11 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2"
                  style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
                  New Contract
                </button>
              )}
            </div>
          )}

          {/* Contract grid */}
          {!loading && !error && displayedContracts.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedContracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onEdit={() => openEdit(contract)}
                    onDelete={fetchContracts}
                    onStatusChanged={handleStatusChanged}
                  />
                ))}
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
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
                    Page {page} of {Math.ceil(total / PAGE_SIZE)}
                  </p>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * PAGE_SIZE >= total}
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
