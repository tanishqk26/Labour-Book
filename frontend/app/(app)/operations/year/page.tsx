"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import Select from "@/components/ui/Select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plot { id: string; name: string; }
interface PaginatedPlots { items: Plot[]; }

interface FarmYear {
  id: string; year: number;
  start_date: string; end_date: string;
  transition_date: string | null;
  effective_transition_date: string;
  plot_count: number;
}
interface PaginatedFarmYears { items: FarmYear[]; }

interface PlotLifecycle {
  id: string; lifecycle_type: string; name: string;
  start_date: string | null; end_date: string | null;
}
interface PlotFarmYearRead {
  id: string; plot_id: string; farm_year_id: string;
  crop_name: string | null; variety: string | null; acreage: number | null; notes: string | null;
  lifecycles: PlotLifecycle[];
}
interface FarmYearDetailRead extends FarmYear {
  plot_farm_years: PlotFarmYearRead[];
}

interface LifecycleSummary { id: string; lifecycle_type: string; name: string; }
interface PlotOperation {
  id: string; plot_id: string;
  plot_lifecycle_id: string | null;
  lifecycle: LifecycleSummary | null;
  operation_date: string; operation_type: string; notes: string | null;
  created_at: string;
}
interface PaginatedOps { items: PlotOperation[]; total: number; has_more: boolean; }

interface Photo {
  id: string; operation_id: string; storage_path: string;
  public_url: string; caption: string | null; sort_order: number;
}
interface Worker {
  id: string;
  labour_id: string | null; team_id: string | null; hours_worked: number | null;
  labour: { id: string; name: string; daily_wage: number } | null;
  team:   { id: string; name: string; daily_wage: number; car_rent: number; manager_fee: number } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OP_TYPE_ICON: Record<string, string> = {
  irrigation: "water_drop", fertilizer: "compost", pesticide: "pest_control",
  fungicide: "science", insecticide: "pest_control", leaf_removal: "yard",
  shoot_management: "cut", weeding: "grass", bunch_management: "grapes",
  harvest: "agriculture", other: "more_horiz",
};

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtMonthDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}
function fmtMonthYear(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor:"rgba(0,0,0,0.85)" }} onClick={onClose}>
      <img src={url} alt="" className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain"
        onClick={e => e.stopPropagation()} />
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor:"rgba(255,255,255,0.15)", color:"white" }} onClick={onClose}>
        <span className="material-symbols-outlined" style={{ fontSize:"22px" }}>close</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle stage card
// ---------------------------------------------------------------------------

function LifecycleCard({
  lc, opCount, isSelected, onClick,
}: {
  lc: PlotLifecycle; opCount: number; isSelected: boolean; onClick: () => void;
}) {
  const isVeg = lc.lifecycle_type === "vegetative";
  const emoji = isVeg ? "🌱" : "🍇";
  const accentColor = isVeg ? "var(--color-tertiary)" : "var(--color-primary)";
  const bgColor = isVeg ? "var(--color-tertiary-fixed)" : "var(--color-primary-fixed)";

  const start = lc.start_date ? fmtMonthYear(lc.start_date) : "—";
  const end   = lc.end_date   ? fmtMonthYear(lc.end_date)   : "—";

  return (
    <button type="button" onClick={onClick}
      className="flex-1 rounded-2xl p-4 text-left transition-all"
      style={{
        border: `2px solid ${isSelected ? accentColor : "var(--color-outline-variant)"}`,
        backgroundColor: isSelected ? bgColor : "var(--color-surface-container-low)",
      }}>
      <div className="text-2xl mb-1">{emoji}</div>
      <h3 className="text-body-md font-bold leading-tight" style={{ color:"var(--color-on-surface)" }}>
        {isVeg ? "Vegetative growth" : "Fruit production"}
      </h3>
      <p className="text-label-caps mt-0.5" style={{ color:"var(--color-on-surface-variant)" }}>
        {start} → {end}
      </p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-headline-sm font-bold" style={{ color: accentColor }}>{opCount}</span>
        <span className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>operations</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Timeline item
// ---------------------------------------------------------------------------

function TimelineItem({ op, photos, workers, lifecycle, onPhotoClick }: {
  op: PlotOperation;
  photos: Photo[];
  workers: Worker[];
  lifecycle: PlotLifecycle | null;
  onPhotoClick: (url: string) => void;
}) {
  const icon = OP_TYPE_ICON[op.operation_type] ?? "more_horiz";
  const isVeg = lifecycle?.lifecycle_type === "vegetative";
  const lcColor = isVeg ? "var(--color-tertiary)" : "var(--color-primary)";
  const lcBg    = isVeg ? "var(--color-tertiary-fixed)" : "var(--color-primary-fixed)";

  const labourCost = workers.filter(w => w.labour_id).reduce((s, w) => s + (w.labour?.daily_wage ?? 0), 0);

  return (
    <div className="flex gap-3">
      {/* Timeline spine dot */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width:"28px" }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: lcBg }}>
          <span className="material-symbols-outlined" style={{ fontSize:"14px", color: lcColor }}>{icon}</span>
        </div>
        <div className="flex-1 w-px mt-1" style={{ backgroundColor:"var(--color-outline-variant)", minHeight:"8px" }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        {/* Header row */}
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label-caps font-bold" style={{ color:"var(--color-on-surface)" }}>
                {fmtDate(op.operation_date)}
              </span>
              {lifecycle && (
                <span className="text-label-caps px-1.5 py-0.5 rounded" style={{ backgroundColor: lcBg, color: lcColor }}>
                  {isVeg ? "🌱 Shoot" : "🍇 Fruit"}
                </span>
              )}
            </div>
            <p className="text-body-md font-semibold mt-0.5 capitalize" style={{ color:"var(--color-on-surface)" }}>
              {op.operation_type.replace(/_/g, " ")}
            </p>
          </div>
          <Link href={`/operations?date=${op.operation_date}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            title="View in daily view"
            style={{ backgroundColor:"var(--color-surface-container)", color:"var(--color-on-surface-variant)" }}>
            <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>open_in_new</span>
          </Link>
        </div>

        {/* Notes */}
        {op.notes && (
          <p className="text-body-md mt-1" style={{ color:"var(--color-on-surface-variant)" }}>{op.notes}</p>
        )}

        {/* Workers */}
        {workers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {workers.map(w => {
              const name = w.labour?.name ?? w.team?.name ?? "—";
              return (
                <span key={w.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-label-caps"
                  style={{ backgroundColor:"var(--color-secondary-fixed)", color:"var(--color-on-secondary-fixed)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize:"10px" }}>
                    {w.team_id ? "group_work" : "person"}
                  </span>
                  {name}
                  {w.hours_worked != null && <span style={{ opacity:0.6 }}> · {w.hours_worked}h</span>}
                </span>
              );
            })}
            {labourCost > 0 && (
              <span className="text-label-caps px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor:"var(--color-primary-fixed)", color:"var(--color-primary)" }}>
                ₹{labourCost.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {photos.map(p => (
              <button key={p.id} type="button" onClick={() => onPhotoClick(p.public_url)}
                className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                style={{ border:"1px solid var(--color-outline-variant)" }}>
                <img src={p.public_url} alt={p.caption ?? ""} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FarmYearOverviewPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();

  const [plots,     setPlots]     = useState<Plot[]>([]);
  const [farmYears, setFarmYears] = useState<FarmYear[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState(params.get("plot_id") ?? "");
  const [selectedYearId, setSelectedYearId] = useState(params.get("farm_year_id") ?? "");

  const [farmYearDetail, setFarmYearDetail] = useState<FarmYearDetailRead | null>(null);
  const [enrollment,     setEnrollment]     = useState<PlotFarmYearRead | null>(null);

  const [operations, setOperations] = useState<PlotOperation[]>([]);
  const [photosMap,  setPhotosMap]  = useState<Record<string, Photo[]>>({});
  const [workersMap, setWorkersMap] = useState<Record<string, Worker[]>>({});

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingOps,  setLoadingOps]  = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Filters
  const [filterLifecycle, setFilterLifecycle] = useState("");
  const [filterType,      setFilterType]      = useState("");
  const [filterDateFrom,  setFilterDateFrom]  = useState("");
  const [filterDateTo,    setFilterDateTo]    = useState("");

  // ---------------------------------------------------------------------------
  // Load plots + farm years on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoadingMeta(true);
      try {
        const [pd, fyd] = await Promise.all([
          apiGet<PaginatedPlots>("/api/v1/plots?status=active&page_size=100"),
          apiGet<PaginatedFarmYears>("/api/v1/farm-years?page_size=50"),
        ]);
        setPlots(pd.items);
        setFarmYears(fyd.items);
      } finally {
        setLoadingMeta(false);
      }
    }
    load();
  }, []);

  // ---------------------------------------------------------------------------
  // Sync URL params
  // ---------------------------------------------------------------------------
  function updateUrl(plotId: string, yearId: string) {
    const q = new URLSearchParams();
    if (plotId) q.set("plot_id", plotId);
    if (yearId) q.set("farm_year_id", yearId);
    router.replace(`/operations/year?${q.toString()}`);
  }

  function handlePlotChange(plotId: string) {
    setSelectedPlotId(plotId);
    setEnrollment(null);
    setOperations([]);
    updateUrl(plotId, selectedYearId);
  }

  function handleYearChange(yearId: string) {
    setSelectedYearId(yearId);
    setEnrollment(null);
    setOperations([]);
    updateUrl(selectedPlotId, yearId);
  }

  // ---------------------------------------------------------------------------
  // Load farm year detail + enrollment when both selectors are set
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedPlotId || !selectedYearId) {
      setEnrollment(null); setFarmYearDetail(null); setOperations([]); return;
    }
    let cancelled = false;
    async function load() {
      setLoadingOps(true);
      try {
        const detail = await apiGet<FarmYearDetailRead>(`/api/v1/farm-years/${selectedYearId}`);
        if (cancelled) return;
        setFarmYearDetail(detail);
        const found = detail.plot_farm_years.find(pfy => pfy.plot_id === selectedPlotId) ?? null;
        setEnrollment(found);
        if (!found) { setLoadingOps(false); return; }

        // Fetch all operations for this plot within the farm year date range (paginate if needed)
        const allOps: PlotOperation[] = [];
        const lcIds = new Set((found.lifecycles ?? []).map(lc => lc.id));
        let page = 1;
        while (true) {
          const opsData = await apiGet<PaginatedOps>(
            `/api/v1/plot-operations?plot_id=${selectedPlotId}&page_size=100&page=${page}`
          );
          if (cancelled) return;
          allOps.push(...opsData.items.filter(op => op.plot_lifecycle_id && lcIds.has(op.plot_lifecycle_id)));
          if (!opsData.has_more) break;
          page++;
        }
        // Sort ascending for timeline
        const ops = [...allOps].sort((a, b) =>
          a.operation_date.localeCompare(b.operation_date) || a.created_at.localeCompare(b.created_at)
        );
        setOperations(ops);
        setPhotosMap({}); setWorkersMap({});

        // Fetch workers + photos for all ops in parallel
        await Promise.allSettled(ops.map(async op => {
          const [ws, ps] = await Promise.allSettled([
            apiGet<Worker[]>(`/api/v1/plot-operations/${op.id}/workers`),
            apiGet<Photo[]>(`/api/v1/plot-operations/${op.id}/photos`),
          ]);
          if (cancelled) return;
          setWorkersMap(prev => ({ ...prev, [op.id]: ws.status === "fulfilled" ? ws.value : [] }));
          setPhotosMap(prev =>  ({ ...prev, [op.id]: ps.status === "fulfilled" ? ps.value : [] }));
        }));
      } catch { /* errors are non-fatal — show what we have */ }
      finally { if (!cancelled) setLoadingOps(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedPlotId, selectedYearId]);

  // ---------------------------------------------------------------------------
  // Derived: lifecycle lookup map
  // ---------------------------------------------------------------------------
  const lifecycleMap = useMemo<Record<string, PlotLifecycle>>(() => {
    if (!enrollment) return {};
    return Object.fromEntries(enrollment.lifecycles.map(lc => [lc.id, lc]));
  }, [enrollment]);

  // Op count per lifecycle
  const opCountByLifecycle = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const op of operations) {
      if (op.plot_lifecycle_id) counts[op.plot_lifecycle_id] = (counts[op.plot_lifecycle_id] ?? 0) + 1;
    }
    return counts;
  }, [operations]);

  // ---------------------------------------------------------------------------
  // Filtered operations
  // ---------------------------------------------------------------------------
  const filteredOps = useMemo(() => {
    return operations.filter(op => {
      if (filterLifecycle && op.plot_lifecycle_id !== filterLifecycle) return false;
      if (filterType && op.operation_type !== filterType) return false;
      if (filterDateFrom && op.operation_date < filterDateFrom) return false;
      if (filterDateTo   && op.operation_date > filterDateTo)   return false;
      return true;
    });
  }, [operations, filterLifecycle, filterType, filterDateFrom, filterDateTo]);

  const hasFilters = !!(filterLifecycle || filterType || filterDateFrom || filterDateTo);
  const opTypes = useMemo(() => [...new Set(operations.map(o => o.operation_type))].sort(), [operations]);

  // ---------------------------------------------------------------------------
  // Shared styles
  // ---------------------------------------------------------------------------
  const inputStyle = {
    border:"1px solid var(--color-outline-variant)",
    backgroundColor:"var(--color-surface-container-lowest)",
    color:"var(--color-on-surface)",
    outline:"none",
  } as React.CSSProperties;

  const selectedPlot = plots.find(p => p.id === selectedPlotId);
  const selectedYear = farmYears.find(y => y.id === selectedYearId);

  // ---------------------------------------------------------------------------
  // Render: loading
  // ---------------------------------------------------------------------------
  if (loadingMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor:"var(--color-background)" }}>
        <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor:"var(--color-primary)" }} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ backgroundColor:"var(--color-background)" }}>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 px-4 md:px-6 pt-4 pb-3" style={{ backgroundColor:"var(--color-background)" }}>
        <div className="flex items-center gap-3">
          <Link href="/operations"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor:"var(--color-surface-container)", color:"var(--color-on-surface-variant)" }}>
            <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>arrow_back</span>
          </Link>
          <div className="flex-1">
            <p className="text-label-caps font-semibold tracking-widest" style={{ color:"var(--color-primary)" }}>FARM WORK</p>
            <h1 className="text-headline-sm font-bold" style={{ color:"var(--color-on-surface)" }}>Year Overview</h1>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Select
            className="flex-1 min-w-[140px]"
            value={selectedPlotId}
            onChange={handlePlotChange}
            placeholder="Select Plot…"
            options={plots.map(p => ({ value: p.id, label: p.name }))}
          />
          <Select
            className="flex-1 min-w-[140px]"
            value={selectedYearId}
            onChange={handleYearChange}
            placeholder="Select Year…"
            options={farmYears.map(y => ({ value: y.id, label: `${y.year} Grape Year` }))}
          />
        </div>
      </div>

      <div className="px-4 md:px-6">

        {/* ── Nothing selected ─────────────────────────────────────────── */}
        {(!selectedPlotId || !selectedYearId) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor:"var(--color-primary-fixed)" }}>
              <span className="material-symbols-outlined" style={{ fontSize:"30px", color:"var(--color-primary)" }}>landscape</span>
            </div>
            <p className="text-body-lg font-semibold" style={{ color:"var(--color-on-surface)" }}>
              {t("operations.selectPlot")} &amp; {t("operations.selectYear")}
            </p>
            <p className="text-body-md" style={{ color:"var(--color-on-surface-variant)" }}>
              {t("operations.yearOverviewDesc")}
            </p>
          </div>
        )}

        {/* ── Loading ops ──────────────────────────────────────────────── */}
        {selectedPlotId && selectedYearId && loadingOps && (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor:"var(--color-primary)" }} />
            <span className="text-body-md" style={{ color:"var(--color-on-surface-variant)" }}>Loading…</span>
          </div>
        )}

        {/* ── Not enrolled ─────────────────────────────────────────────── */}
        {selectedPlotId && selectedYearId && !loadingOps && farmYearDetail && enrollment === null && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-4xl">🌿</span>
            <p className="text-body-lg font-semibold" style={{ color:"var(--color-on-surface)" }}>
              {t("operations.noEnrollment")}
            </p>
            <p className="text-body-md" style={{ color:"var(--color-on-surface-variant)" }}>
              {selectedPlot?.name} · {selectedYear?.year} {t("operations.grapeYear")}
            </p>
          </div>
        )}

        {/* ── Overview ─────────────────────────────────────────────────── */}
        {enrollment && farmYearDetail && !loadingOps && (
          <>
            {/* Year heading */}
            <div className="mb-4">
              <h2 className="text-headline-md font-bold" style={{ color:"var(--color-on-surface)" }}>
                {farmYearDetail.year} Grape Year
              </h2>
              {enrollment.crop_name && (
                <p className="text-body-md" style={{ color:"var(--color-on-surface-variant)" }}>
                  {enrollment.crop_name}{enrollment.variety ? ` · ${enrollment.variety}` : ""}
                  {enrollment.acreage ? ` · ${enrollment.acreage} ac` : ""}
                </p>
              )}
              <p className="text-label-caps mt-0.5" style={{ color:"var(--color-on-surface-variant)" }}>
                {fmtMonthDay(farmYearDetail.start_date)} → {fmtMonthDay(farmYearDetail.end_date)}
                {farmYearDetail.transition_date && (
                  <> · transition {fmtMonthDay(farmYearDetail.effective_transition_date)}</>
                )}
              </p>
            </div>

            {/* Lifecycle cards */}
            <div className="flex gap-3 mb-5">
              {enrollment.lifecycles.map(lc => (
                <LifecycleCard
                  key={lc.id}
                  lc={lc}
                  opCount={opCountByLifecycle[lc.id] ?? 0}
                  isSelected={filterLifecycle === lc.id}
                  onClick={() => setFilterLifecycle(prev => prev === lc.id ? "" : lc.id)}
                />
              ))}
            </div>

            {/* Stats row */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {[
                { label: "Total Ops", value: String(operations.length) },
                { label: "Days Active", value: String(new Set(operations.map(o => o.operation_date)).size) },
                { label: "With Photos", value: String(operations.filter(o => (photosMap[o.id]?.length ?? 0) > 0).length) },
                { label: "With Workers", value: String(operations.filter(o => (workersMap[o.id]?.length ?? 0) > 0).length) },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 min-w-[80px] rounded-xl px-3 py-2 text-center"
                  style={{ backgroundColor:"var(--color-surface-container-low)", border:"1px solid var(--color-outline-variant)" }}>
                  <p className="text-headline-sm font-bold" style={{ color:"var(--color-primary)" }}>{value}</p>
                  <p className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* ── Filters ────────────────────────────────────────────────── */}
            <div className="rounded-2xl p-4 mb-5 flex flex-col gap-2"
              style={{ backgroundColor:"var(--color-surface-container-low)", border:"1px solid var(--color-outline-variant)" }}>
              <div className="flex items-center justify-between">
                <span className="text-label-caps font-semibold" style={{ color:"var(--color-on-surface-variant)" }}>
                  FILTERS {hasFilters && `· ${filteredOps.length} of ${operations.length} shown`}
                </span>
                {hasFilters && (
                  <button type="button"
                    className="text-label-caps"
                    style={{ color:"var(--color-primary)" }}
                    onClick={() => { setFilterLifecycle(""); setFilterType(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
                    Clear all
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Select
                  className="flex-1 min-w-[130px]"
                  value={filterLifecycle}
                  onChange={setFilterLifecycle}
                  options={[
                    { value: "", label: "All Stages" },
                    ...enrollment.lifecycles.map(lc => ({
                      value: lc.id,
                      label: lc.lifecycle_type === "vegetative" ? "Shoot Dev." : "Fruit Prod.",
                    })),
                  ]}
                />
                <Select
                  className="flex-1 min-w-[130px]"
                  value={filterType}
                  onChange={setFilterType}
                  options={[
                    { value: "", label: "All Types" },
                    ...opTypes.map(ot => ({ value: ot, label: ot.replace(/_/g, " ") })),
                  ]}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <span className="text-label-caps flex-shrink-0" style={{ color:"var(--color-on-surface-variant)" }}>From</span>
                  <input type="date" className="flex-1 h-9 px-2 rounded-lg text-body-md" style={inputStyle}
                    value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <span className="text-label-caps flex-shrink-0" style={{ color:"var(--color-on-surface-variant)" }}>To</span>
                  <input type="date" className="flex-1 h-9 px-2 rounded-lg text-body-md" style={inputStyle}
                    value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Timeline ───────────────────────────────────────────────── */}
            <div className="rounded-2xl p-4 mb-6"
              style={{ backgroundColor:"var(--color-surface-container-low)", border:"1px solid var(--color-outline-variant)" }}>
              <h3 className="text-body-lg font-bold mb-4" style={{ color:"var(--color-on-surface)" }}>
                Timeline
                {hasFilters && filteredOps.length !== operations.length && (
                  <span className="text-body-md font-normal ml-2" style={{ color:"var(--color-on-surface-variant)" }}>
                    ({filteredOps.length} shown)
                  </span>
                )}
              </h3>

              {filteredOps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <span className="material-symbols-outlined" style={{ fontSize:"36px", color:"var(--color-outline)" }}>search_off</span>
                  <p className="text-body-md" style={{ color:"var(--color-on-surface-variant)" }}>
                    {hasFilters ? t("operations.noOpsYear") + " (filtered)" : t("operations.noOpsYear")}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Group by month for readability */}
                  {(() => {
                    const months: Record<string, PlotOperation[]> = {};
                    for (const op of filteredOps) {
                      const m = op.operation_date.slice(0, 7); // "2026-04"
                      if (!months[m]) months[m] = [];
                      months[m].push(op);
                    }
                    return Object.entries(months).map(([monthKey, monthOps]) => {
                      const [y, m] = monthKey.split("-");
                      const monthLabel = `${MONTH_ABBR[parseInt(m)-1]} ${y}`;
                      return (
                        <div key={monthKey} className="mb-4 last:mb-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-label-caps font-bold" style={{ color:"var(--color-on-surface-variant)" }}>
                              {monthLabel}
                            </span>
                            <span className="text-label-caps px-1.5 py-0.5 rounded"
                              style={{ backgroundColor:"var(--color-surface-container)", color:"var(--color-on-surface-variant)" }}>
                              {monthOps.length}
                            </span>
                          </div>
                          {monthOps.map(op => (
                            <TimelineItem
                              key={op.id}
                              op={op}
                              photos={photosMap[op.id] ?? []}
                              workers={workersMap[op.id] ?? []}
                              lifecycle={op.plot_lifecycle_id ? (lifecycleMap[op.plot_lifecycle_id] ?? null) : null}
                              onPhotoClick={setLightboxUrl}
                            />
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
