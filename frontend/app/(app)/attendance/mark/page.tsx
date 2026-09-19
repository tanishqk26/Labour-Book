"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import TimePicker from "@/components/ui/TimePicker";
import Select from "@/components/ui/Select";
import { useLanguage } from "@/context/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  wage_type: string;
  contract_id: string | null;
  contract_title: string | null;
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
  work_start_time: string | null;
  work_end_time: string | null;
  wage_earned: number | null;
  wage_type: string;
  contract_id: string | null;
  contract_title: string | null;
}

interface DailyAttendanceView {
  labours: LabourAttendanceStatus[];
  teams: TeamAttendanceStatus[];
}

interface AllLabour {
  id: string;
  name: string;
  hometown: string | null;
  daily_wage: number;
  work_start_time: string | null;
  work_end_time: string | null;
}

interface AllTeam {
  id: string;
  name: string;
  daily_wage: number;
  car_rent: number;
  manager_fee: number;
}

interface ContractOption {
  id: string;
  title: string;
  amount: number;
}

interface PlotOption {
  id: string;
  name: string;
  size_acres: number;
  crop_name?: string | null;
}

// Local checklist items
interface LabourChecklistItem {
  type: "labour";
  id: string; // labour_id
  name: string;
  daily_wage: number;
  attendance_id: string | null;
  isPresent: boolean;
  task: string;
  startTime: string;
  endTime: string;
  expanded: boolean;
  wageType: "daily" | "contract";
  contractId: string;
}

interface TeamChecklistItem {
  type: "team";
  id: string; // team_id
  name: string;
  daily_wage: number;
  car_rent: number;
  manager_fee: number;
  attendance_id: string | null;
  isPresent: boolean;
  numLabourers: string; // kept as string for input binding
  task: string;
  startTime: string;
  endTime: string;
  expanded: boolean;
  wageType: "daily" | "contract";
  contractId: string;
}

type ChecklistItem = LabourChecklistItem | TeamChecklistItem;

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

const TEAM_AVATAR = { bg: "#e8d5f7", color: "#3d1457" };

// Compute team wage locally for display
function computeTeamWage(item: TeamChecklistItem): number {
  const n = Number(item.numLabourers) || 0;
  if (!item.isPresent || n === 0) return 0;
  return n * item.daily_wage + item.car_rent + item.manager_fee;
}

// ---------------------------------------------------------------------------
// Quick Create Labour — minimal inline form
// ---------------------------------------------------------------------------

interface QuickCreateLabourProps {
  defaultName: string;
  onCreated: (labour: AllLabour) => void;
  onCancel: () => void;
}

function QuickCreateLabour({ defaultName, onCreated, onCancel }: QuickCreateLabourProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(defaultName);
  const [wage, setWage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !wage || Number(wage) <= 0) {
      setError(t("attendance.nameWageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiPost<AllLabour>("/api/v1/labours", {
        name: name.trim(),
        daily_wage: Number(wage),
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setError(typeof data?.detail === "string" ? data.detail : t("attendance.failedCreateLabour"));
      } else {
        setError(t("attendance.networkErrorTryAgain"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="mx-3 my-3 p-4 rounded-xl flex flex-col gap-3"
      style={{
        backgroundColor: "var(--color-primary-fixed)",
        border: "1px solid var(--color-primary-fixed-dim)",
      }}
    >
      <p className="text-label-caps font-semibold" style={{ color: "var(--color-primary)" }}>
        {t("attendance.createNewLabour")}
      </p>
      {error && (
        <p className="text-label-caps" style={{ color: "var(--color-error)" }}>{error}</p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.fullName")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("attendance.namePlaceholderExample")}
          autoFocus
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{
            border: "1px solid var(--color-outline-variant)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-on-surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.dailyWage")}</label>
        <input
          type="number"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
          placeholder={t("attendance.wagePlaceholderExample")}
          min={1}
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{
            border: "1px solid var(--color-outline-variant)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-on-surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold"
          style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)", opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? t("attendance.creating") : t("attendance.createAndAdd")}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Quick Create Team — minimal inline form
// ---------------------------------------------------------------------------

interface QuickCreateTeamProps {
  defaultName: string;
  onCreated: (team: AllTeam) => void;
  onCancel: () => void;
}

function QuickCreateTeam({ defaultName, onCreated, onCancel }: QuickCreateTeamProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(defaultName);
  const [wage, setWage] = useState("");
  const [carRent, setCarRent] = useState("0");
  const [managerFee, setManagerFee] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !wage || Number(wage) <= 0) {
      setError(t("attendance.teamNameWageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiPost<AllTeam>("/api/v1/teams", {
        name: name.trim(),
        daily_wage: Number(wage),
        car_rent: Number(carRent) || 0,
        manager_fee: Number(managerFee) || 0,
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setError(typeof data?.detail === "string" ? data.detail : t("attendance.failedCreateTeam"));
      } else {
        setError(t("attendance.networkErrorTryAgain"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="mx-3 my-3 p-4 rounded-xl flex flex-col gap-3"
      style={{
        backgroundColor: "#f3e8ff",
        border: "1px solid #d8b4fe",
      }}
    >
      <p className="text-label-caps font-semibold" style={{ color: "#6b21a8" }}>
        {t("attendance.createNewTeam")}
      </p>
      {error && (
        <p className="text-label-caps" style={{ color: "var(--color-error)" }}>{error}</p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>{t("attendance.teamName")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("attendance.teamNamePlaceholderExample")}
          autoFocus
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{
            border: "1px solid var(--color-outline-variant)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-on-surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>{t("attendance.wagePerLabour")}</label>
        <input
          type="number"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
          placeholder={t("attendance.teamWagePlaceholderExample")}
          min={1}
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{
            border: "1px solid var(--color-outline-variant)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-on-surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>{t("attendance.carRent")}</label>
        <input
          type="number"
          value={carRent}
          onChange={(e) => setCarRent(e.target.value)}
          placeholder="0"
          min={0}
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{
            border: "1px solid var(--color-outline-variant)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-on-surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>{t("attendance.managerFee")}</label>
        <input
          type="number"
          value={managerFee}
          onChange={(e) => setManagerFee(e.target.value)}
          placeholder="0"
          min={0}
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{
            border: "1px solid var(--color-outline-variant)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-on-surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold"
          style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity"
          style={{ backgroundColor: "#6b21a8", color: "#fff", opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? t("attendance.creating") : t("attendance.createAndAdd")}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Quick Create Contract — minimal inline form for a specific entity
// ---------------------------------------------------------------------------

interface QuickCreateContractProps {
  entityType: "labour" | "team";
  entityId: string;
  onCreated: (contract: ContractOption) => void;
  onCancel: () => void;
}

function QuickCreateContract({ entityType, entityId, onCreated, onCancel }: QuickCreateContractProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [plotId, setPlotId] = useState("");
  const [ratePerAcre, setRatePerAcre] = useState("");
  const [assignedDate] = useState(todayISO());
  const [plots, setPlots] = useState<PlotOption[]>([]);
  const [plotsLoading, setPlotsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active plots on mount
  useEffect(() => {
    apiGet<{ items: PlotOption[] }>("/api/v1/plots?status=active&page_size=100")
      .then((d) => setPlots(d.items))
      .catch(() => {})
      .finally(() => setPlotsLoading(false));
  }, []);

  const selectedPlot = plots.find((p) => p.id === plotId) ?? null;
  const calculatedAmount =
    selectedPlot && ratePerAcre && Number(ratePerAcre) > 0
      ? Number(ratePerAcre) * selectedPlot.size_acres
      : null;

  // Auto-fill amount when rate × acres resolves
  useEffect(() => {
    if (calculatedAmount !== null) setAmount(String(calculatedAmount));
  }, [calculatedAmount]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0) {
      setError("Work description and amount are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        amount: Number(amount),
        entity_type: entityType === "labour" ? "individual" : "team",
        assigned_date: assignedDate,
        status: "active",
        plot_id: plotId || undefined,
        amount_per_acre: plotId && ratePerAcre ? Number(ratePerAcre) : undefined,
      };
      if (entityType === "labour") payload.labour_id = entityId;
      else payload.team_id = entityId;

      const created = await apiPost<ContractOption & { title: string; amount: number }>("/api/v1/contracts", payload);
      onCreated({ id: created.id, title: created.title, amount: created.amount });
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setError(typeof data?.detail === "string" ? data.detail : t("attendance.failedCreateLabour"));
      } else {
        setError(t("attendance.networkErrorTryAgain"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    border: "1px solid var(--color-outline-variant)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-on-surface)",
    outline: "none",
  };

  return (
    <form
      onSubmit={handleCreate}
      className="mx-0 my-2 p-4 rounded-xl flex flex-col gap-3"
      style={{ backgroundColor: "#fef9c3", border: "1px solid #fde68a" }}
    >
      <p className="text-label-caps font-semibold" style={{ color: "#92400e" }}>Create new contract</p>
      {error && <p className="text-label-caps" style={{ color: "var(--color-error)" }}>{error}</p>}

      {/* Work description */}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#92400e" }}>Work description *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Harvest North Field"
          autoFocus
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={inputStyle}
        />
      </div>

      {/* Plot (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#92400e" }}>Plot <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
        {plotsLoading ? (
          <div className="h-10 flex items-center gap-2 px-3 rounded-lg" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#92400e" }} />
            <span className="text-body-md">Loading plots…</span>
          </div>
        ) : (
          <Select
            value={plotId}
            onChange={(v) => { setPlotId(v); if (!v) { setRatePerAcre(""); } }}
            placeholder="No plot — enter amount directly"
            options={plots.map((p) => ({
              value: p.id,
              label: `${p.name} — ${p.size_acres} acres${p.crop_name ? ` (${p.crop_name})` : ""}`,
            }))}
          />
        )}
      </div>

      {/* Rate per acre — only when plot selected */}
      {plotId && (
        <div className="flex flex-col gap-1">
          <label className="text-label-caps" style={{ color: "#92400e" }}>Rate per acre (₹)</label>
          <input
            type="number"
            value={ratePerAcre}
            onChange={(e) => setRatePerAcre(e.target.value)}
            placeholder="e.g. 2000"
            min={1}
            className="h-10 px-3 rounded-lg text-body-md w-full"
            style={inputStyle}
          />
          {calculatedAmount !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "#fde68a", border: "1px solid #fbbf24" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#92400e" }}>calculate</span>
              <p className="text-label-caps" style={{ color: "#92400e" }}>
                {ratePerAcre} × {selectedPlot?.size_acres} acres = <strong>₹{calculatedAmount.toLocaleString("en-IN")}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Agreed amount */}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#92400e" }}>
          {plotId ? "Total amount (₹, auto-calculated)" : "Agreed amount (₹) *"}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 5000"
          min={1}
          readOnly={calculatedAmount !== null}
          className="h-10 px-3 rounded-lg text-body-md w-full"
          style={{ ...inputStyle, opacity: calculatedAmount !== null ? 0.75 : 1, cursor: calculatedAmount !== null ? "not-allowed" : "text" }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold"
          style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity"
          style={{ backgroundColor: "#92400e", color: "#fff", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Creating…" : "Create & select"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Add Panel — combined picker for labours + teams
// ---------------------------------------------------------------------------

interface AddPanelProps {
  allLabours: AllLabour[];
  allTeams: AllTeam[];
  presentLabourIds: Set<string>;
  presentTeamIds: Set<string>;
  onAddLabour: (labour: AllLabour) => void;
  onAddTeam: (team: AllTeam) => void;
  onClose: () => void;
  onNewLabourCreated: (labour: AllLabour) => void;
  onNewTeamCreated: (team: AllTeam) => void;
}

function AddPanel({
  allLabours,
  allTeams,
  presentLabourIds,
  presentTeamIds,
  onAddLabour,
  onAddTeam,
  onClose,
  onNewLabourCreated,
  onNewTeamCreated,
}: AddPanelProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [showCreateLabour, setShowCreateLabour] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const availableLabours = allLabours.filter(
    (l) => !presentLabourIds.has(l.id) && l.name.toLowerCase().includes(search.toLowerCase())
  );
  const availableTeams = allTeams.filter(
    (t) => !presentTeamIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase())
  );
  const noResults = availableLabours.length === 0 && availableTeams.length === 0;
  const showingCreate = showCreateLabour || showCreateTeam;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex flex-col shadow-2xl"
          style={{
            width: "min(500px, 100%)",
            maxHeight: "80vh",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-outline-variant)",
            borderRadius: "var(--radius-lg)",
            pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
          >
            <h3 className="text-headline-md" style={{ color: "var(--color-primary)" }}>
              {t("attendance.addToTodaysList")}
            </h3>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Search — hidden when a create form is active */}
          {!showingCreate && (
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("attendance.searchLabourOrTeam")}
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
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {/* Quick create forms */}
            {showCreateLabour && (
              <QuickCreateLabour
                defaultName={search}
                onCreated={(l) => { onNewLabourCreated(l); onAddLabour(l); setShowCreateLabour(false); setSearch(""); }}
                onCancel={() => setShowCreateLabour(false)}
              />
            )}
            {showCreateTeam && (
              <QuickCreateTeam
                defaultName={search}
                onCreated={(t) => { onNewTeamCreated(t); onAddTeam(t); setShowCreateTeam(false); setSearch(""); }}
                onCancel={() => setShowCreateTeam(false)}
              />
            )}

            {!showingCreate && noResults && (
              <div className="py-8 text-center px-4">
                <p className="text-body-md mb-4" style={{ color: "var(--color-on-surface-variant)" }}>
                  {search ? `${t("attendance.noMatchFor")} "${search}"` : t("attendance.everyonePresent")}
                </p>
              </div>
            )}

            {/* Available labours */}
            {!showingCreate && availableLabours.length > 0 && (
              <>
                <div className="px-6 py-2" style={{ backgroundColor: "var(--color-surface-container-low)" }}>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.labourersFilter")}</p>
                </div>
                {availableLabours.map((labour) => (
                  <button
                    key={labour.id}
                    onClick={() => onAddLabour(labour)}
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
                    </div>
                    <span className="text-label-caps flex-shrink-0" style={{ color: "var(--color-on-surface-variant)" }}>
                      {formatCurrency(labour.daily_wage)}{t("attendance.perDay")}
                    </span>
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: "18px", color: "var(--color-primary)" }}>
                      add_circle
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Available teams */}
            {!showingCreate && availableTeams.length > 0 && (
              <>
                <div className="px-6 py-2" style={{ backgroundColor: "var(--color-surface-container-low)" }}>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.teamsFilter")}</p>
                </div>
                {availableTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => onAddTeam(team)}
                    className="w-full flex items-center gap-3 px-6 py-3 text-left transition-colors hover:opacity-80"
                    style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-label-caps flex-shrink-0"
                      style={{ backgroundColor: TEAM_AVATAR.bg, color: TEAM_AVATAR.color }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>groups</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>{team.name}</p>
                      <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                        {formatCurrency(team.daily_wage)}{t("attendance.perLabourSuffix")} + {formatCurrency(team.car_rent)} {t("attendance.carSuffix")} + {formatCurrency(team.manager_fee)} {t("attendance.mgrSuffix")}
                      </p>
                    </div>
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: "18px", color: "#6b21a8" }}>
                      add_circle
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Create buttons always at bottom */}
            {!showingCreate && (
              <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
                <button
                  onClick={() => setShowCreateLabour(true)}
                  className="flex-1 h-10 rounded-xl text-body-md font-semibold flex items-center gap-2 justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--color-primary-fixed)", color: "var(--color-primary)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>person_add</span>
                  {t("attendance.createLabourBtn")}
                </button>
                <button
                  onClick={() => setShowCreateTeam(true)}
                  className="flex-1 h-10 rounded-xl text-body-md font-semibold flex items-center gap-2 justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#f3e8ff", color: "#6b21a8" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>group_add</span>
                  {t("attendance.createTeamBtn")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarkAttendancePage() {
  const { t } = useLanguage();
  const today = todayISO();
  const router = useRouter();

  const [allLabours, setAllLabours] = useState<AllLabour[]>([]);
  const [allTeams, setAllTeams] = useState<AllTeam[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Contract support: cache loaded contracts per entity ID
  const [contractsCache, setContractsCache] = useState<Record<string, ContractOption[]>>({});
  const [contractsLoadingIds, setContractsLoadingIds] = useState<Set<string>>(new Set());
  const [showContractCreate, setShowContractCreate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailyData, laboursData, teamsData] = await Promise.all([
        apiGet<DailyAttendanceView>(`/api/v1/attendance/daily?for_date=${today}`),
        apiGet<{ items: AllLabour[] }>("/api/v1/labours?status=active&page_size=100"),
        apiGet<{ items: AllTeam[] }>("/api/v1/teams?status=active&page_size=100"),
      ]);
      setAllLabours(laboursData.items);
      setAllTeams(teamsData.items);

      const items: ChecklistItem[] = [];

      // Map labour data (pre-fill times from attendance record, or from labour defaults)
      for (const r of dailyData.labours) {
        // Find the full labour object to get default times if attendance has none
        const labourFull = laboursData.items.find((l) => l.id === r.labour_id);
        items.push({
          type: "labour",
          id: r.labour_id,
          name: r.labour_name,
          daily_wage: r.daily_wage,
          attendance_id: r.attendance_id,
          isPresent: r.status === "present" || r.status === "half_day",
          task: r.task ?? "",
          startTime: r.work_start_time ?? labourFull?.work_start_time ?? "",
          endTime: r.work_end_time ?? labourFull?.work_end_time ?? "",
          expanded: false,
          wageType: (r.wage_type === "contract" ? "contract" : "daily") as "daily" | "contract",
          contractId: r.contract_id ?? "",
        });
      }

      // Map team data
      for (const r of dailyData.teams) {
        items.push({
          type: "team",
          id: r.team_id,
          name: r.team_name,
          daily_wage: r.daily_wage,
          car_rent: r.car_rent,
          manager_fee: r.manager_fee,
          attendance_id: r.attendance_id,
          isPresent: r.status === "present",
          numLabourers: r.num_labourers != null ? String(r.num_labourers) : "",
          task: r.task ?? "",
          startTime: r.work_start_time ?? "",
          endTime: r.work_end_time ?? "",
          expanded: false,
          wageType: (r.wage_type === "contract" ? "contract" : "daily") as "daily" | "contract",
          contractId: r.contract_id ?? "",
        });
      }

      setChecklist(items);
    } catch {
      setError(t("attendance.loadErrorMark"));
    } finally {
      setLoading(false);
    }
  }, [today, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Checklist mutations
  // ---------------------------------------------------------------------------

  function togglePresent(itemId: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isPresent: !item.isPresent } : item
      )
    );
  }

  function toggleExpand(itemId: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, expanded: !item.expanded } : item
      )
    );
  }

  function updateField(itemId: string, field: string, value: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  }

  function removeFromList(itemId: string) {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  }

  // ---------------------------------------------------------------------------
  // Contract support
  // ---------------------------------------------------------------------------

  async function loadContractsForEntity(entityId: string, entityType: "labour" | "team") {
    if (contractsCache[entityId] !== undefined) return; // already loaded
    setContractsLoadingIds((prev) => { const s = new Set(prev); s.add(entityId); return s; });
    try {
      const param = entityType === "labour" ? "labour_id" : "team_id";
      const data = await apiGet<{ items: ContractOption[] }>(`/api/v1/contracts?${param}=${entityId}&status=active&page_size=100`);
      setContractsCache((prev) => ({ ...prev, [entityId]: data.items }));
    } catch {
      setContractsCache((prev) => ({ ...prev, [entityId]: [] }));
    } finally {
      setContractsLoadingIds((prev) => { const s = new Set(prev); s.delete(entityId); return s; });
    }
  }

  function setWageTypeForItem(itemId: string, wageType: "daily" | "contract") {
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        // When switching to contract, auto-expand so user can select contract
        if (wageType === "contract") {
          const entityType = item.type === "labour" ? "labour" : "team";
          loadContractsForEntity(item.id, entityType);
          return { ...item, wageType, contractId: "", expanded: true };
        }
        return { ...item, wageType, contractId: "" };
      })
    );
  }

  function setContractForItem(itemId: string, contractId: string) {
    setChecklist((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, contractId } : item)
    );
  }

  function addLabourToList(labour: AllLabour) {
    if (checklist.some((item) => item.type === "labour" && item.id === labour.id)) return;
    setChecklist((prev) => [
      ...prev,
      {
        type: "labour",
        id: labour.id,
        name: labour.name,
        daily_wage: labour.daily_wage,
        attendance_id: null,
        isPresent: true,
        task: "",
        // Pre-fill default work hours from the labour's saved profile
        startTime: labour.work_start_time ?? "",
        endTime: labour.work_end_time ?? "",
        // Auto-expand if there are default times so user can see/confirm them
        expanded: !!(labour.work_start_time || labour.work_end_time),
        wageType: "daily",
        contractId: "",
      },
    ]);
  }

  function addTeamToList(team: AllTeam) {
    if (checklist.some((item) => item.type === "team" && item.id === team.id)) return;
    setChecklist((prev) => [
      ...prev,
      {
        type: "team",
        id: team.id,
        name: team.name,
        daily_wage: team.daily_wage,
        car_rent: team.car_rent,
        manager_fee: team.manager_fee,
        attendance_id: null,
        isPresent: true,
        numLabourers: "",
        task: "",
        startTime: "",
        endTime: "",
        expanded: true, // auto-expand to prompt for headcount
        wageType: "daily",
        contractId: "",
      },
    ]);
  }

  function handleNewLabourCreated(labour: AllLabour) {
    setAllLabours((prev) => [...prev, labour]);
  }

  function handleNewTeamCreated(team: AllTeam) {
    setAllTeams((prev) => [...prev, team]);
  }

  // ---------------------------------------------------------------------------
  // Save — batch all changes
  // ---------------------------------------------------------------------------

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const records: Record<string, unknown>[] = [];

    for (const item of checklist) {
      let hours_worked: number | null = null;
      if (item.startTime && item.endTime) {
        const [sh, sm] = item.startTime.split(":").map(Number);
        const [eh, em] = item.endTime.split(":").map(Number);
        const diff = eh * 60 + em - (sh * 60 + sm);
        if (diff > 0) hours_worked = parseFloat((diff / 60).toFixed(2));
      }

      if (item.type === "labour") {
        records.push({
          labour_id: item.id,
          date: today,
          status: item.isPresent ? "present" : "absent",
          task: item.task?.trim() || (item.isPresent ? "Field Work" : null),
          hours_worked,
          work_start_time: item.startTime || null,
          work_end_time: item.endTime || null,
          wage_type: item.wageType,
          contract_id: item.wageType === "contract" && item.contractId ? item.contractId : null,
        });
      } else {
        records.push({
          team_id: item.id,
          date: today,
          status: item.isPresent ? "present" : "absent",
          num_labourers: item.isPresent ? (Number(item.numLabourers) || 0) : null,
          task: item.task?.trim() || (item.isPresent ? "Field Work" : null),
          hours_worked,
          work_start_time: item.startTime || null,
          work_end_time: item.endTime || null,
          wage_type: item.wageType,
          contract_id: item.wageType === "contract" && item.contractId ? item.contractId : null,
        });
      }
    }

    if (records.length === 0) {
      // Allow saving with empty list — marks "attendance done with nobody"
      router.push("/dashboard");
      return;
    }

    try {
      await apiPost("/api/v1/attendance/bulk", { date: today, records });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setSaveError(typeof data?.detail === "string" ? data.detail : t("attendance.saveErrorGeneric"));
      } else {
        setSaveError(t("attendance.networkErrorRetry"));
      }
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const labourItems = checklist.filter((r): r is LabourChecklistItem => r.type === "labour");
  const teamItems = checklist.filter((r): r is TeamChecklistItem => r.type === "team");

  const presentLabourCount = labourItems.filter((r) => r.isPresent).length;
  const presentTeamCount = teamItems.filter((r) => r.isPresent).length;

  const labourWage = labourItems
    .filter((r) => r.isPresent)
    .reduce((sum, r) => sum + r.daily_wage, 0);
  const teamWage = teamItems
    .filter((r) => r.isPresent)
    .reduce((sum, r) => sum + computeTeamWage(r), 0);
  const totalWage = labourWage + teamWage;

  const presentLabourIds = new Set(labourItems.map((r) => r.id));
  const presentTeamIds = new Set(teamItems.map((r) => r.id));

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <title>{`${t("attendance.markPageTitle")} | LabourBook`}</title>

      {showAddPanel && (
        <AddPanel
          allLabours={allLabours}
          allTeams={allTeams}
          presentLabourIds={presentLabourIds}
          presentTeamIds={presentTeamIds}
          onAddLabour={addLabourToList}
          onAddTeam={addTeamToList}
          onClose={() => setShowAddPanel(false)}
          onNewLabourCreated={handleNewLabourCreated}
          onNewTeamCreated={handleNewTeamCreated}
        />
      )}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        {/* Header */}
        <header
          className="px-4 md:px-8 py-4 md:py-6 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface)" }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity flex-shrink-0"
            style={{ color: "var(--color-on-surface-variant)", border: "1px solid var(--color-outline-variant)" }}
            aria-label={t("attendance.backToDashboard")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-label-caps hidden sm:block" style={{ color: "var(--color-on-surface-variant)" }}>
              {dateLabel.toUpperCase()}
            </p>
            <h1 className="text-body-lg md:text-headline-md font-semibold" style={{ color: "var(--color-primary)" }}>
              {t("attendance.markTodaysAttendance")}
            </h1>
          </div>
          {/* Summary pill */}
          {!loading && checklist.length > 0 && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.present")}</p>
                <p className="text-body-md md:text-headline-md font-bold" style={{ color: "#2d7a4f" }}>{presentLabourCount + presentTeamCount}</p>
              </div>
              <div className="text-center hidden sm:block">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.cost")}</p>
                <p className="text-body-md md:text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>{formatCurrency(totalWage)}</p>
              </div>
            </div>
          )}
        </header>

        <div className="px-4 md:px-8 py-6 flex flex-col gap-4">

          {/* Hint — compact inline, no card */}
          {!loading && !error && checklist.length > 0 && (
            <p className="text-label-caps flex items-center gap-1.5" style={{ color: "var(--color-outline)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>info</span>
              {t("attendance.hint")}
            </p>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--color-primary)" }}
                />
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{t("common.loading")}</p>
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
              <button
                onClick={fetchData}
                className="px-5 py-2 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}
              >
                {t("attendance.tryAgain")}
              </button>
            </div>
          )}

          {/* Checklist */}
          {!loading && !error && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid var(--color-outline-variant)",
                backgroundColor: "var(--color-surface-container-lowest)",
              }}
            >
              {/* Empty state */}
              {checklist.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--color-outline)" }}>
                    groups
                  </span>
                  <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                    {t("attendance.emptyChecklist")}
                  </p>
                </div>
              )}

              {/* Labour rows */}
              {labourItems.length > 0 && (
                <div
                  className="px-4 py-2"
                  style={{ backgroundColor: "var(--color-surface-container-low)", borderBottom: "1px solid var(--color-outline-variant)" }}
                >
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                    {t("attendance.labourersFilter")} ({labourItems.length})
                  </p>
                </div>
              )}
              {labourItems.map((item, idx) => {
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div
                    key={`l-${item.id}`}
                    style={{
                      borderBottom: "1px solid var(--color-outline-variant)",
                      backgroundColor: item.isPresent ? "rgba(193,236,212,0.12)" : "transparent",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Checkbox toggle */}
                      <button
                        onClick={() => togglePresent(item.id)}
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: item.isPresent ? "#2d7a4f" : "transparent",
                          border: item.isPresent ? "2px solid #2d7a4f" : "2px solid var(--color-outline)",
                        }}
                        aria-label={item.isPresent ? t("attendance.markAbsentAria") : t("attendance.markPresentAria")}
                      >
                        {item.isPresent && (
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fff" }}>
                            check
                          </span>
                        )}
                      </button>

                      {/* Avatar + Name */}
                      <button
                        onClick={() => togglePresent(item.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-label-caps flex-shrink-0"
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.color, opacity: item.isPresent ? 1 : 0.5 }}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-body-md font-semibold truncate"
                            style={{
                              color: "var(--color-on-surface)",
                              opacity: item.isPresent ? 1 : 0.5,
                            }}
                          >
                            {item.name}
                          </p>
                          <p className="text-label-caps" style={{ color: item.isPresent ? "#2d7a4f" : "var(--color-outline)" }}>
                            {item.isPresent ? `${t("attendance.present")} · ${formatCurrency(item.daily_wage)}` : t("attendance.absent")}
                          </p>
                        </div>
                      </button>

                      {/* Wage type toggle — Daily | Contract */}
                      <div className="flex items-center rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--color-outline-variant)" }}>
                        <button
                          type="button"
                          onClick={() => setWageTypeForItem(item.id, "daily")}
                          className="h-7 px-2 text-label-caps font-semibold transition-colors"
                          style={{
                            backgroundColor: item.wageType === "daily" ? "#2d7a4f" : "transparent",
                            color: item.wageType === "daily" ? "#fff" : "var(--color-on-surface-variant)",
                          }}
                        >
                          Daily
                        </button>
                        <button
                          type="button"
                          onClick={() => setWageTypeForItem(item.id, "contract")}
                          className="h-7 px-2 text-label-caps font-semibold transition-colors"
                          style={{
                            backgroundColor: item.wageType === "contract" ? "#6b21a8" : "transparent",
                            color: item.wageType === "contract" ? "#fff" : "var(--color-on-surface-variant)",
                            borderLeft: "1px solid var(--color-outline-variant)",
                          }}
                        >
                          Contract
                        </button>
                      </div>

                      {/* Expand button */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 flex-shrink-0"
                        style={{
                          color: item.expanded ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                          border: "1px solid var(--color-outline-variant)",
                        }}
                        aria-label={t("attendance.addDetailsAria")}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                          {item.expanded ? "expand_less" : "notes"}
                        </span>
                      </button>

                      {/* Remove — clearly separated from present toggle */}
                      <button
                        onClick={() => removeFromList(item.id)}
                        className="h-8 px-2 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{
                          color: "var(--color-error)",
                          border: "1px solid var(--color-error)",
                          fontSize: "12px",
                        }}
                        aria-label={t("attendance.removeFromListAria")}
                        title={t("attendance.removeFromTodaysListTitle")}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                        <span className="text-label-caps">{t("common.remove")}</span>
                      </button>
                    </div>

                    {/* Expandable details */}
                    {item.expanded && (
                      <div
                        className="px-4 pb-4 flex flex-col gap-3"
                        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
                      >
                        <p className="text-label-caps pt-3" style={{ color: "var(--color-on-surface-variant)" }}>
                          {t("attendance.detailsOptional")}
                        </p>

                        {/* Contract selector (shown when wageType === "contract") */}
                        {item.wageType === "contract" && (
                          <div className="flex flex-col gap-2">
                            <label className="text-label-caps" style={{ color: "#6b21a8" }}>
                              Linked contract
                            </label>
                            {contractsLoadingIds.has(item.id) ? (
                              <div className="h-11 flex items-center gap-2 px-3 rounded-lg" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
                                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#6b21a8" }} />
                                <span className="text-body-md">Loading contracts…</span>
                              </div>
                            ) : (
                              <Select
                                value={item.contractId}
                                onChange={(v) => setContractForItem(item.id, v)}
                                placeholder="Select a contract…"
                                options={(contractsCache[item.id] ?? []).map((c) => ({ value: c.id, label: `${c.title} — ₹${c.amount.toLocaleString("en-IN")}` }))}
                                onAddNew={() => setShowContractCreate(item.id)}
                                addNewLabel="Add new contract"
                              />
                            )}
                            {showContractCreate === item.id && (
                              <QuickCreateContract
                                entityType="labour"
                                entityId={item.id}
                                onCreated={(contract) => {
                                  setContractsCache((prev) => ({
                                    ...prev,
                                    [item.id]: [...(prev[item.id] ?? []), contract],
                                  }));
                                  setContractForItem(item.id, contract.id);
                                  setShowContractCreate(null);
                                }}
                                onCancel={() => setShowContractCreate(null)}
                              />
                            )}
                          </div>
                        )}

                        <input
                          type="text"
                          value={item.task}
                          onChange={(e) => updateField(item.id, "task", e.target.value)}
                          placeholder={t("attendance.taskPlaceholderExample")}
                          className="w-full h-10 px-3 rounded-lg text-body-md"
                          style={{
                            border: "1px solid var(--color-outline-variant)",
                            backgroundColor: "var(--color-surface-container)",
                            color: "var(--color-on-surface)",
                            outline: "none",
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <TimePicker
                            value={item.startTime}
                            onChange={(val) => updateField(item.id, "startTime", val)}
                            className="flex-1"
                          />
                          <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("common.to")}</span>
                          <TimePicker
                            value={item.endTime}
                            onChange={(val) => updateField(item.id, "endTime", val)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Team rows */}
              {teamItems.length > 0 && (
                <div
                  className="px-4 py-2"
                  style={{ backgroundColor: "#f3e8ff", borderBottom: "1px solid var(--color-outline-variant)" }}
                >
                  <p className="text-label-caps" style={{ color: "#6b21a8" }}>
                    {t("attendance.teamsFilter")} ({teamItems.length})
                  </p>
                </div>
              )}
              {teamItems.map((item) => {
                const wage = computeTeamWage(item);
                return (
                  <div
                    key={`t-${item.id}`}
                    style={{
                      borderBottom: "1px solid var(--color-outline-variant)",
                      backgroundColor: item.isPresent ? "rgba(232,213,247,0.15)" : "transparent",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Checkbox toggle */}
                      <button
                        onClick={() => togglePresent(item.id)}
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: item.isPresent ? "#6b21a8" : "transparent",
                          border: item.isPresent ? "2px solid #6b21a8" : "2px solid var(--color-outline)",
                        }}
                        aria-label={item.isPresent ? t("attendance.markAbsentAria") : t("attendance.markPresentAria")}
                      >
                        {item.isPresent && (
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fff" }}>
                            check
                          </span>
                        )}
                      </button>

                      {/* Avatar + Name */}
                      <button
                        onClick={() => togglePresent(item.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: TEAM_AVATAR.bg, color: TEAM_AVATAR.color, opacity: item.isPresent ? 1 : 0.5 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>groups</span>
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-body-md font-semibold truncate"
                            style={{
                              color: "var(--color-on-surface)",
                              opacity: item.isPresent ? 1 : 0.5,
                            }}
                          >
                            {item.name}
                          </p>
                          <p className="text-label-caps" style={{ color: item.isPresent ? "#6b21a8" : "var(--color-outline)" }}>
                            {item.isPresent
                              ? `${t("attendance.present")}${item.numLabourers ? ` · ${item.numLabourers} ${t("attendance.peopleLabel")} · ${formatCurrency(wage)}` : ""}`
                              : t("attendance.absent")}
                          </p>
                        </div>
                      </button>

                      {/* Number of labourers input — always visible for teams when present */}
                      {item.isPresent && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            value={item.numLabourers}
                            onChange={(e) => updateField(item.id, "numLabourers", e.target.value)}
                            placeholder="0"
                            min={0}
                            className="w-16 h-8 px-2 rounded-lg text-body-md text-center"
                            style={{
                              border: "1px solid var(--color-outline-variant)",
                              backgroundColor: "var(--color-surface-container)",
                              color: "var(--color-on-surface)",
                              outline: "none",
                            }}
                          />
                          <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.peopleLabel")}</span>
                        </div>
                      )}

                      {/* Expand */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 flex-shrink-0"
                        style={{
                          color: item.expanded ? "#6b21a8" : "var(--color-on-surface-variant)",
                          border: "1px solid var(--color-outline-variant)",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                          {item.expanded ? "expand_less" : "notes"}
                        </span>
                      </button>

                      {/* Wage type toggle — Daily | Contract */}
                      <div className="flex items-center rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--color-outline-variant)" }}>
                        <button
                          type="button"
                          onClick={() => setWageTypeForItem(item.id, "daily")}
                          className="h-7 px-2 text-label-caps font-semibold transition-colors"
                          style={{
                            backgroundColor: item.wageType === "daily" ? "#6b21a8" : "transparent",
                            color: item.wageType === "daily" ? "#fff" : "var(--color-on-surface-variant)",
                          }}
                        >
                          Daily
                        </button>
                        <button
                          type="button"
                          onClick={() => setWageTypeForItem(item.id, "contract")}
                          className="h-7 px-2 text-label-caps font-semibold transition-colors"
                          style={{
                            backgroundColor: item.wageType === "contract" ? "#92400e" : "transparent",
                            color: item.wageType === "contract" ? "#fff" : "var(--color-on-surface-variant)",
                            borderLeft: "1px solid var(--color-outline-variant)",
                          }}
                        >
                          Contract
                        </button>
                      </div>

                      {/* Remove — clearly distinct from present toggle */}
                      <button
                        onClick={() => removeFromList(item.id)}
                        className="h-8 px-2 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{
                          color: "var(--color-error)",
                          border: "1px solid var(--color-error)",
                          fontSize: "12px",
                        }}
                        aria-label={t("attendance.removeFromListAria")}
                        title={t("attendance.removeFromTodaysListTitle")}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                        <span className="text-label-caps">{t("common.remove")}</span>
                      </button>

                    </div>

                    {/* Expandable details */}
                    {item.expanded && (
                      <div
                        className="px-4 pb-4 flex flex-col gap-3"
                        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
                      >
                        <p className="text-label-caps pt-3" style={{ color: "var(--color-on-surface-variant)" }}>
                          {t("attendance.detailsOptional")}
                        </p>

                        {/* Contract selector for teams */}
                        {item.wageType === "contract" && (
                          <div className="flex flex-col gap-2">
                            <label className="text-label-caps" style={{ color: "#92400e" }}>Linked contract</label>
                            {contractsLoadingIds.has(item.id) ? (
                              <div className="h-11 flex items-center gap-2 px-3 rounded-lg" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
                                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#92400e" }} />
                                <span className="text-body-md">Loading contracts…</span>
                              </div>
                            ) : (
                              <Select
                                value={item.contractId}
                                onChange={(v) => setContractForItem(item.id, v)}
                                placeholder="Select a contract…"
                                options={(contractsCache[item.id] ?? []).map((c) => ({ value: c.id, label: `${c.title} — ₹${c.amount.toLocaleString("en-IN")}` }))}
                                onAddNew={() => setShowContractCreate(item.id)}
                                addNewLabel="Add new contract"
                              />
                            )}
                            {showContractCreate === item.id && (
                              <QuickCreateContract
                                entityType="team"
                                entityId={item.id}
                                onCreated={(contract) => {
                                  setContractsCache((prev) => ({
                                    ...prev,
                                    [item.id]: [...(prev[item.id] ?? []), contract],
                                  }));
                                  setContractForItem(item.id, contract.id);
                                  setShowContractCreate(null);
                                }}
                                onCancel={() => setShowContractCreate(null)}
                              />
                            )}
                          </div>
                        )}

                        <input
                          type="text"
                          value={item.task}
                          onChange={(e) => updateField(item.id, "task", e.target.value)}
                          placeholder={t("attendance.taskPlaceholder")}
                          className="w-full h-10 px-3 rounded-lg text-body-md"
                          style={{
                            border: "1px solid var(--color-outline-variant)",
                            backgroundColor: "var(--color-surface-container)",
                            color: "var(--color-on-surface)",
                            outline: "none",
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <TimePicker
                            value={item.startTime}
                            onChange={(val) => updateField(item.id, "startTime", val)}
                            className="flex-1"
                          />
                          <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("common.to")}</span>
                          <TimePicker
                            value={item.endTime}
                            onChange={(val) => updateField(item.id, "endTime", val)}
                            className="flex-1"
                          />
                        </div>
                        {/* Wage breakdown */}
                        {item.wageType === "daily" && item.isPresent && Number(item.numLabourers) > 0 && (
                          <div
                            className="px-3 py-2 rounded-lg text-label-caps"
                            style={{ backgroundColor: "#f3e8ff", color: "#6b21a8" }}
                          >
                            {item.numLabourers} × {formatCurrency(item.daily_wage)} + {formatCurrency(item.car_rent)} {t("attendance.carSuffix")} + {formatCurrency(item.manager_fee)} {t("attendance.mgrSuffix")} = <strong>{formatCurrency(wage)}</strong>
                          </div>
                        )}
                        {item.wageType === "contract" && item.contractId && (
                          <div className="px-3 py-2 rounded-lg text-label-caps" style={{ backgroundColor: "#fef9c3", color: "#92400e" }}>
                            <span className="material-symbols-outlined align-middle" style={{ fontSize: "14px" }}>description</span>
                            {" "}Contract: {contractsCache[item.id]?.find((c) => c.id === item.contractId)?.title ?? "Selected"} — wage tracked via contract
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add row */}
              <div
                className="px-4 py-4"
                style={{ borderTop: checklist.length > 0 ? "1px solid var(--color-outline-variant)" : "none" }}
              >
                <button
                  onClick={() => setShowAddPanel(true)}
                  id="add-to-list-btn"
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-body-md font-semibold transition-opacity hover:opacity-80 w-full justify-center"
                  style={{
                    border: "1.5px dashed var(--color-outline-variant)",
                    color: "var(--color-on-surface-variant)",
                    backgroundColor: "transparent",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
                  {t("attendance.addLabourOrTeam")}
                </button>
              </div>
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div
              className="px-4 py-3 rounded-xl text-body-md"
              style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}
            >
              {saveError}
            </div>
          )}

          {/* Footer — summary + save */}
          {!loading && !error && (
            <div
              className="rounded-2xl px-4 md:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              style={{
                backgroundColor: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <div className="flex gap-4 sm:gap-6 flex-wrap">
                <div>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.inList")}</p>
                  <p className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>{checklist.length}</p>
                </div>
                <div>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.present")}</p>
                  <p className="text-headline-md font-bold" style={{ color: "#2d7a4f" }}>{presentLabourCount + presentTeamCount}</p>
                </div>
                {totalWage > 0 && (
                  <div>
                    <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.todaysCost")}</p>
                    <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>
                      {formatCurrency(totalWage)}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                id="save-attendance-btn"
                className="w-full sm:w-auto h-11 px-6 rounded-xl text-body-md font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "white" }} />
                    {t("attendance.saving")}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>save</span>
                    {t("attendance.saveAttendance")}
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
