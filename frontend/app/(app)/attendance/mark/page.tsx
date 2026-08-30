"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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
}

interface AllTeam {
  id: string;
  name: string;
  daily_wage: number;
  car_rent: number;
  manager_fee: number;
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
  const [name, setName] = useState(defaultName);
  const [wage, setWage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !wage || Number(wage) <= 0) {
      setError("Name and daily wage are required.");
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
        setError(typeof data?.detail === "string" ? data.detail : "Failed to create labour.");
      } else {
        setError("Network error. Try again.");
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
        Create New Labour
      </p>
      {error && (
        <p className="text-label-caps" style={{ color: "var(--color-error)" }}>{error}</p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Full Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ramesh Shinde"
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
        <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Daily Wage (₹/day) *</label>
        <input
          type="number"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
          placeholder="e.g. 500"
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)", opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? "Creating…" : "Create & Add"}
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
  const [name, setName] = useState(defaultName);
  const [wage, setWage] = useState("");
  const [carRent, setCarRent] = useState("0");
  const [managerFee, setManagerFee] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !wage || Number(wage) <= 0) {
      setError("Team name and daily wage are required.");
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
        setError(typeof data?.detail === "string" ? data.detail : "Failed to create team.");
      } else {
        setError("Network error. Try again.");
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
        Create New Team
      </p>
      {error && (
        <p className="text-label-caps" style={{ color: "var(--color-error)" }}>{error}</p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>Team Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Shinde Team"
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
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>Wage per Labour (₹/day) *</label>
        <input
          type="number"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
          placeholder="e.g. 400"
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
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>Car Rent (₹/day)</label>
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
        <label className="text-label-caps" style={{ color: "#6b21a8" }}>Manager Fee (₹/day)</label>
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity"
          style={{ backgroundColor: "#6b21a8", color: "#fff", opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? "Creating…" : "Create & Add"}
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
              Add to Today&apos;s List
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
                placeholder="Search labourer or team..."
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
                  {search ? `No match for "${search}"` : "Everyone is already in today's list"}
                </p>
              </div>
            )}

            {/* Available labours */}
            {!showingCreate && availableLabours.length > 0 && (
              <>
                <div className="px-6 py-2" style={{ backgroundColor: "var(--color-surface-container-low)" }}>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Labourers</p>
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
                      {formatCurrency(labour.daily_wage)}/day
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
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Teams</p>
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
                        {formatCurrency(team.daily_wage)}/labour + {formatCurrency(team.car_rent)} car + {formatCurrency(team.manager_fee)} mgr
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
                  Create Labour
                </button>
                <button
                  onClick={() => setShowCreateTeam(true)}
                  className="flex-1 h-10 rounded-xl text-body-md font-semibold flex items-center gap-2 justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#f3e8ff", color: "#6b21a8" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>group_add</span>
                  Create Team
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

      // Map labour data
      for (const r of dailyData.labours) {
        items.push({
          type: "labour",
          id: r.labour_id,
          name: r.labour_name,
          daily_wage: r.daily_wage,
          attendance_id: r.attendance_id,
          isPresent: r.status === "present" || r.status === "half_day",
          task: r.task ?? "",
          startTime: r.work_start_time ?? "",
          endTime: r.work_end_time ?? "",
          expanded: false,
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
        });
      }

      setChecklist(items);
    } catch {
      setError("Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  }, [today]);

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
        startTime: "",
        endTime: "",
        expanded: false,
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
          task: item.task || null,
          hours_worked,
          work_start_time: item.startTime || null,
          work_end_time: item.endTime || null,
        });
      } else {
        records.push({
          team_id: item.id,
          date: today,
          status: item.isPresent ? "present" : "absent",
          num_labourers: item.isPresent ? (Number(item.numLabourers) || 0) : null,
          task: item.task || null,
          hours_worked,
          work_start_time: item.startTime || null,
          work_end_time: item.endTime || null,
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
        setSaveError(typeof data?.detail === "string" ? data.detail : "Failed to save attendance.");
      } else {
        setSaveError("Network error. Please try again.");
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
      <title>Mark Attendance | LabourBook</title>

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
            aria-label="Back to dashboard"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-label-caps hidden sm:block" style={{ color: "var(--color-on-surface-variant)" }}>
              {dateLabel.toUpperCase()}
            </p>
            <h1 className="text-body-lg md:text-headline-md font-semibold" style={{ color: "var(--color-primary)" }}>
              Mark Today&apos;s Attendance
            </h1>
          </div>
          {/* Summary pill */}
          {!loading && checklist.length > 0 && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Present</p>
                <p className="text-body-md md:text-headline-md font-bold" style={{ color: "#2d7a4f" }}>{presentLabourCount + presentTeamCount}</p>
              </div>
              <div className="text-center hidden sm:block">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Cost</p>
                <p className="text-body-md md:text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>{formatCurrency(totalWage)}</p>
              </div>
            </div>
          )}
        </header>

        <div className="px-4 md:px-8 py-6 flex flex-col gap-4">

          {/* Hint */}
          {!loading && !error && checklist.length > 0 && (
            <div
              className="px-4 py-3 rounded-xl flex items-start gap-3"
              style={{
                backgroundColor: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <span className="material-symbols-outlined mt-0.5" style={{ fontSize: "18px", color: "var(--color-on-surface-variant)" }}>
                info
              </span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Tap the <strong>circle</strong> to mark present/absent. Use <span style={{ color: "var(--color-error)" }}>✕ Remove</span> to remove someone from today&apos;s list. For teams, enter number of workers when present.
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
              <button
                onClick={fetchData}
                className="px-5 py-2 rounded-lg text-body-md font-semibold"
                style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}
              >
                Try Again
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
                    No one in today&apos;s list yet. Use the button below to add.
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
                    Labourers ({labourItems.length})
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
                        aria-label={item.isPresent ? "Mark absent" : "Mark present"}
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
                            {item.isPresent ? `Present · ${formatCurrency(item.daily_wage)}` : "Absent"}
                          </p>
                        </div>
                      </button>

                      {/* Expand button */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 flex-shrink-0"
                        style={{
                          color: item.expanded ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                          border: "1px solid var(--color-outline-variant)",
                        }}
                        aria-label="Add details"
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
                        aria-label="Remove from list"
                        title="Remove from today's list"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                        <span className="text-label-caps">Remove</span>
                      </button>
                    </div>

                    {/* Expandable details */}
                    {item.expanded && (
                      <div
                        className="px-4 pb-4 flex flex-col gap-3"
                        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
                      >
                        <p className="text-label-caps pt-3" style={{ color: "var(--color-on-surface-variant)" }}>
                          Details (optional)
                        </p>
                        <input
                          type="text"
                          value={item.task}
                          onChange={(e) => updateField(item.id, "task", e.target.value)}
                          placeholder="Task / work done (e.g. Crop spraying)"
                          className="w-full h-10 px-3 rounded-lg text-body-md"
                          style={{
                            border: "1px solid var(--color-outline-variant)",
                            backgroundColor: "var(--color-surface-container)",
                            color: "var(--color-on-surface)",
                            outline: "none",
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            value={item.startTime}
                            onChange={(e) => updateField(item.id, "startTime", e.target.value)}
                            className="h-10 px-3 rounded-lg text-body-md flex-1"
                            style={{
                              border: "1px solid var(--color-outline-variant)",
                              backgroundColor: "var(--color-surface-container)",
                              color: "var(--color-on-surface)",
                              outline: "none",
                            }}
                          />
                          <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>to</span>
                          <input
                            type="time"
                            value={item.endTime}
                            onChange={(e) => updateField(item.id, "endTime", e.target.value)}
                            className="h-10 px-3 rounded-lg text-body-md flex-1"
                            style={{
                              border: "1px solid var(--color-outline-variant)",
                              backgroundColor: "var(--color-surface-container)",
                              color: "var(--color-on-surface)",
                              outline: "none",
                            }}
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
                    Teams ({teamItems.length})
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
                        aria-label={item.isPresent ? "Mark absent" : "Mark present"}
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
                              ? `Present${item.numLabourers ? ` · ${item.numLabourers} people · ${formatCurrency(wage)}` : ""}`
                              : "Absent"}
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
                          <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>people</span>
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

                      {/* Remove — clearly distinct from present toggle */}
                      <button
                        onClick={() => removeFromList(item.id)}
                        className="h-8 px-2 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{
                          color: "var(--color-error)",
                          border: "1px solid var(--color-error)",
                          fontSize: "12px",
                        }}
                        aria-label="Remove from list"
                        title="Remove from today's list"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                        <span className="text-label-caps">Remove</span>
                      </button>

                    </div>

                    {/* Expandable details */}
                    {item.expanded && (
                      <div
                        className="px-4 pb-4 flex flex-col gap-3"
                        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
                      >
                        <p className="text-label-caps pt-3" style={{ color: "var(--color-on-surface-variant)" }}>
                          Details (optional)
                        </p>
                        <input
                          type="text"
                          value={item.task}
                          onChange={(e) => updateField(item.id, "task", e.target.value)}
                          placeholder="Task / work done"
                          className="w-full h-10 px-3 rounded-lg text-body-md"
                          style={{
                            border: "1px solid var(--color-outline-variant)",
                            backgroundColor: "var(--color-surface-container)",
                            color: "var(--color-on-surface)",
                            outline: "none",
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            value={item.startTime}
                            onChange={(e) => updateField(item.id, "startTime", e.target.value)}
                            className="h-10 px-3 rounded-lg text-body-md flex-1"
                            style={{
                              border: "1px solid var(--color-outline-variant)",
                              backgroundColor: "var(--color-surface-container)",
                              color: "var(--color-on-surface)",
                              outline: "none",
                            }}
                          />
                          <span className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>to</span>
                          <input
                            type="time"
                            value={item.endTime}
                            onChange={(e) => updateField(item.id, "endTime", e.target.value)}
                            className="h-10 px-3 rounded-lg text-body-md flex-1"
                            style={{
                              border: "1px solid var(--color-outline-variant)",
                              backgroundColor: "var(--color-surface-container)",
                              color: "var(--color-on-surface)",
                              outline: "none",
                            }}
                          />
                        </div>
                        {/* Wage breakdown */}
                        {item.isPresent && Number(item.numLabourers) > 0 && (
                          <div
                            className="px-3 py-2 rounded-lg text-label-caps"
                            style={{ backgroundColor: "#f3e8ff", color: "#6b21a8" }}
                          >
                            {item.numLabourers} × {formatCurrency(item.daily_wage)} + {formatCurrency(item.car_rent)} car + {formatCurrency(item.manager_fee)} mgr = <strong>{formatCurrency(wage)}</strong>
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
                  Add Labour or Team
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
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>In List</p>
                  <p className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>{checklist.length}</p>
                </div>
                <div>
                  <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Present</p>
                  <p className="text-headline-md font-bold" style={{ color: "#2d7a4f" }}>{presentLabourCount + presentTeamCount}</p>
                </div>
                {totalWage > 0 && (
                  <div>
                    <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Today&apos;s Cost</p>
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
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>save</span>
                    Save Attendance
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
