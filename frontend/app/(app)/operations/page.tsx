"use client";

import { useEffect, useState, useCallback, useRef, Fragment, useMemo } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plot { id: string; name: string; crop_name?: string | null; }

interface LifecycleSummary {
  id: string;
  lifecycle_type: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface FarmYear {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
}

interface Enrollment {
  id: string;
  plot_id: string;
  farm_year_id: string;
  lifecycles: LifecycleSummary[];
}

interface PaginatedFarmYears { items: FarmYear[]; }
interface PaginatedEnrollments { items: Enrollment[]; }

interface PlotOperation {
  id: string;
  plot_id: string;
  plot_lifecycle_id: string | null;
  lifecycle: LifecycleSummary | null;
  operation_date: string;
  operation_type: string;
  notes: string | null;
  created_at: string;
}

interface Photo {
  id: string;
  operation_id: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

interface PaginatedOps { items: PlotOperation[]; total: number; has_more: boolean; }
interface PaginatedPlots { items: Plot[]; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PHOTOS = 5;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayString() { return toLocalDateString(new Date()); }
function formatTableDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function formatDayName(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
}
// The 3 fixed operation groups
const OP_GROUPS = ["spraying", "labour_work", "other"] as const;
type OpGroup = typeof OP_GROUPS[number];

function displayOpType(type: string, t: (key: string) => string) {
  // Fixed group keys
  const groupKey = `operations.group.${type}`;
  const groupLabel = t(groupKey);
  if (groupLabel !== groupKey) return groupLabel;
  // Legacy free-text fallback
  const legacyKey = `operations.type.${type}`;
  const legacyLabel = t(legacyKey);
  return legacyLabel === legacyKey ? type : legacyLabel;
}

function opGroupIcon(group: string) {
  if (group === "spraying") return "science";
  if (group === "labour_work") return "agriculture";
  return "more_horiz";
}

function grapeYearOf(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

function seasonLabel(year: number) {
  return `${year}–${String(year + 1).slice(2)}`;
}

function formatShort(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function stageTitle(lc: LifecycleSummary, t: (key: string) => string) {
  if (lc.lifecycle_type === "vegetative") return t("operations.lifecycle_vegetative");
  if (lc.lifecycle_type === "fruit_production") return t("operations.lifecycle_fruit_production");
  return lc.name;
}

// ---------------------------------------------------------------------------
// Image compression — uses Canvas API, runs client-side
// ---------------------------------------------------------------------------

const MAX_DIM = 1920;
const WEBP_QUALITY = 0.82;

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas compression failed"));
      }, "image/webp", WEBP_QUALITY);
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

// ---------------------------------------------------------------------------
// Upload helper — native fetch (apiFetch forces application/json, breaks multipart)
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function uploadPhoto(operationId: string, file: File, caption?: string): Promise<Photo> {
  let blob: Blob;
  try { blob = await compressImage(file); }
  catch { blob = file; }   // fallback: send original if Canvas compression fails

  const form = new FormData();
  form.append("file", blob, `photo-${Date.now()}.webp`);
  if (caption) form.append("caption", caption);

  // Do NOT set Content-Type — the browser must set multipart/form-data with its boundary
  const res = await fetch(`${API_BASE}/api/v1/plot-operations/${operationId}/photos`, {
    method: "POST",
    body: form,
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("lb:unauthorized"));
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.detail === "string" ? err.detail : `Upload failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({ photos, startIndex, onClose }: { photos: Photo[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const photo = photos[idx];

  function prev(e: React.MouseEvent) { e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length); }
  function next(e: React.MouseEvent) { e.stopPropagation(); setIdx(i => (i + 1) % photos.length); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx(i => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      {/* Close */}
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }} onClick={onClose}>
        <span className="material-symbols-outlined">close</span>
      </button>

      {/* Prev */}
      {photos.length > 1 && (
        <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }} onClick={prev}>
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}

      {/* Image */}
      <div className="flex flex-col items-center gap-3 max-w-full max-h-full px-16 py-12" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.public_url} alt={photo.caption ?? "Photo"} className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
        {photo.caption && <p className="text-body-md" style={{ color: "rgba(255,255,255,0.8)" }}>{photo.caption}</p>}
        <p className="text-label-caps" style={{ color: "rgba(255,255,255,0.4)" }}>{idx + 1} / {photos.length}</p>
      </div>

      {/* Next */}
      {photos.length > 1 && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }} onClick={next}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo strip — shows thumbnails + upload button, inline below an operation
// ---------------------------------------------------------------------------

function PhotoStrip({
  operationId,
  photos,
  onPhotosChanged,
}: {
  operationId: string;
  photos: Photo[];
  onPhotosChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";     // reset so same file can be re-selected

    const slots = MAX_PHOTOS - photos.length;
    const toUpload = files.slice(0, slots);
    if (!toUpload.length) {
      setUploadError(`Maximum ${MAX_PHOTOS} photos per operation.`);
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await Promise.all(toUpload.map(f => uploadPhoto(operationId, f)));
      onPhotosChanged();
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(photoId);
    try {
      await apiDelete(`/api/v1/plot-operations/${operationId}/photos/${photoId}`);
      onPhotosChanged();
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  }

  return (
    <>
      {lightboxIdx !== null && (
        <Lightbox photos={photos} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      <div className="flex items-center gap-2 flex-wrap mt-1">
        {/* Thumbnails */}
        {photos.map((p, i) => (
          <div key={p.id} className="relative group/thumb flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.public_url}
              alt={p.caption ?? `Photo ${i + 1}`}
              className="w-16 h-16 object-cover rounded-xl cursor-pointer"
              style={{ border: "2px solid var(--color-outline-variant)" }}
              onClick={() => setLightboxIdx(i)}
            />
            {/* Delete overlay */}
            <button
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
              style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "#fff" }}
              onClick={e => handleDelete(p.id, e)}
              disabled={deletingId === p.id}
              aria-label="Delete photo"
            >
              {deletingId === p.id
                ? <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                : <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>close</span>
              }
            </button>
          </div>
        ))}

        {/* Add button */}
        {photos.length < MAX_PHOTOS && (
          <button
            className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
            style={{ border: "2px dashed var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-primary)" }} />
              : <>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-primary)" }}>add_a_photo</span>
                  <span className="text-label-caps" style={{ fontSize: "9px", color: "var(--color-primary)" }}>
                    {photos.length}/{MAX_PHOTOS}
                  </span>
                </>
            }
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {uploadError && (
        <p className="text-label-caps mt-1" style={{ color: "var(--color-error)" }}>{uploadError}</p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit Operation Modal
// ---------------------------------------------------------------------------

interface OpFormProps {
  operation?: PlotOperation;
  plots: Plot[];
  defaultPlotId: string;
  defaultDate: string;
  lifecycles: LifecycleSummary[];
  defaultLifecycleId: string;
  onSaved: () => void;
  onClose: () => void;
}

function OpForm({ operation, plots, defaultPlotId, defaultDate, lifecycles, defaultLifecycleId, onSaved, onClose }: OpFormProps) {
  const { t } = useLanguage();
  const isEdit = !!operation;

  // If editing a legacy free-text op that isn't one of the 3 groups, keep it under "other"
  const existingGroup = (operation && OP_GROUPS.includes(operation.operation_type as OpGroup))
    ? operation.operation_type as OpGroup
    : (operation ? "other" : "spraying");
  // detail = what was done specifically (stored in notes, or legacy op_type if not a group)
  const existingDetail = operation
    ? (OP_GROUPS.includes(operation.operation_type as OpGroup) ? (operation.notes ?? "") : operation.operation_type)
    : "";

  const [plotId, setPlotId] = useState(operation?.plot_id ?? defaultPlotId);
  const [lifecycleId, setLifecycleId] = useState(operation?.plot_lifecycle_id ?? defaultLifecycleId);
  const [group, setGroup] = useState<OpGroup>(existingGroup as OpGroup);
  const [detail, setDetail] = useState(existingDetail);
  const [opDate, setOpDate] = useState(operation?.operation_date ?? defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plotId) { setError("Please select a plot."); return; }
    if (!lifecycleId) { setError(t("operations.stageRequired")); return; }
    setSubmitting(true); setError(null);
    try {
      const payload = {
        plot_id: plotId,
        plot_lifecycle_id: lifecycleId,
        operation_type: group,
        operation_date: opDate,
        notes: detail.trim() || null,
      };
      if (isEdit) {
        await apiPatch(`/api/v1/plot-operations/${operation!.id}`, payload);
      } else {
        await apiPost<PlotOperation>("/api/v1/plot-operations", payload);
      }
      onSaved();
    } catch (err) {
      const d = err instanceof ApiError ? (err.data as {detail?:string}|null) : null;
      setError(typeof d?.detail === "string" ? d.detail : t("operations.saveError"));
      setSubmitting(false);
    }
  }

  const inputStyle = { border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)", color:"var(--color-on-surface)", outline:"none" };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor:"rgba(0,0,0,0.5)", backdropFilter:"blur(2px)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents:"none" }}>
        <div className="flex flex-col shadow-2xl w-full" style={{ maxWidth:"460px", maxHeight:"90vh", backgroundColor:"var(--color-surface)", border:"1px solid var(--color-outline-variant)", borderRadius:"var(--radius-lg)", pointerEvents:"auto" }} onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom:"1px solid var(--color-outline-variant)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor:"var(--color-primary-fixed)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"20px", color:"var(--color-primary)" }}>agriculture</span>
              </div>
              <h2 className="text-headline-md" style={{ color:"var(--color-primary)" }}>{isEdit ? t("operations.editOperation") : t("operations.addOperation")}</h2>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70" style={{ color:"var(--color-on-surface-variant)" }}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {error && <p className="px-4 py-2 rounded-lg text-label-caps" style={{ backgroundColor:"var(--color-error-container)", color:"var(--color-error)" }}>{error}</p>}

            {/* Plot */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.plotLabel")}</label>
              <Select value={plotId} onChange={setPlotId} placeholder={t("operations.plotPlaceholder")}
                options={plots.map(p => ({ value: p.id, label: p.crop_name ? `${p.name} — ${p.crop_name}` : p.name }))} />
            </div>

            {/* Stage */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.stageLabel")}</label>
              <Select value={lifecycleId} onChange={setLifecycleId} placeholder={t("operations.stagePlaceholder")}
                options={lifecycles.map(lc => ({ value: lc.id, label: stageTitle(lc, t) }))} />
            </div>

            {/* Operation group — 3 fixed buttons */}
            <div className="flex flex-col gap-2">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.groupLabel")}</label>
              <div className="grid grid-cols-3 gap-2">
                {OP_GROUPS.map((g) => {
                  const sel = group === g;
                  return (
                    <button key={g} type="button" onClick={() => setGroup(g)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl text-body-md font-semibold transition-all"
                      style={{
                        backgroundColor: sel ? "var(--color-primary)" : "var(--color-surface-container-low)",
                        color: sel ? "var(--color-on-primary)" : "var(--color-on-surface)",
                        border: `2px solid ${sel ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
                      }}>
                      <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>{opGroupIcon(g)}</span>
                      <span className="text-label-caps font-bold leading-tight text-center">{t(`operations.group.${g}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What specifically was done */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>
                {group === "spraying" ? t("operations.detailLabelSpraying") : group === "labour_work" ? t("operations.detailLabelLabour") : t("operations.detailLabelOther")}
                <span className="ml-1" style={{ color:"var(--color-on-surface-variant)", opacity:0.6 }}>({t("common.optional")})</span>
              </label>
              <input
                className="w-full h-11 px-3 rounded-lg text-body-md"
                style={inputStyle}
                type="text"
                value={detail}
                onChange={e => setDetail(e.target.value)}
                placeholder={
                  group === "spraying" ? t("operations.detailPlaceholderSpraying")
                  : group === "labour_work" ? t("operations.detailPlaceholderLabour")
                  : t("operations.detailPlaceholderOther")
                }
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.dateLabel")}</label>
              <DatePicker value={opDate} onChange={setOpDate} />
            </div>
          </form>

          <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop:"1px solid var(--color-outline-variant)" }}>
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-body-md font-semibold" style={{ border:"1px solid var(--color-outline-variant)", color:"var(--color-on-surface-variant)" }}>{t("common.cancel")}</button>
            <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={submitting} className="flex-1 h-11 rounded-xl text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor:"var(--color-primary)", color:"var(--color-on-primary)" }}>
              {submitting ? <><span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:"white" }} />{t("operations.saving")}</> : <><span className="material-symbols-outlined" style={{ fontSize:"18px" }}>save</span>{isEdit ? t("common.saveChanges") : t("operations.addOperation")}</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OperationsPage() {

  const { t } = useLanguage();
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [operations, setOperations] = useState<PlotOperation[]>([]);
  const [photosMap, setPhotosMap] = useState<Record<string, Photo[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOp, setEditingOp] = useState<PlotOperation | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [farmYears, setFarmYears] = useState<FarmYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [lifecycleId, setLifecycleId] = useState("");
  const [newSeasonYear, setNewSeasonYear] = useState(() => String(grapeYearOf()));
  const [creatingSeason, setCreatingSeason] = useState(false);
  const stageTouched = useRef(false);

  const [opTypeFilter, setOpTypeFilter] = useState("");

  const lifecycles = enrollment?.lifecycles ?? [];
  const seasonOps = useMemo(() => {
    const ids = new Set(lifecycles.map((lc) => lc.id));
    return operations.filter((op) => op.plot_lifecycle_id && ids.has(op.plot_lifecycle_id));
  }, [operations, lifecycles]);

  // ops for the selected stage, sorted oldest→newest (for day numbering)
  const stageOps = useMemo(
    () => (lifecycleId ? seasonOps.filter((op) => op.plot_lifecycle_id === lifecycleId) : seasonOps)
          .slice()
          .sort((a, b) => a.operation_date.localeCompare(b.operation_date) || a.created_at.localeCompare(b.created_at)),
    [seasonOps, lifecycleId],
  );

  // date → day number: Day 1 = first operation date, Day N = (date - first date) + 1
  const dayNumberMap = useMemo(() => {
    if (stageOps.length === 0) return {} as Record<string, number>;
    const firstDate = new Date(stageOps[0].operation_date + "T00:00:00").getTime();
    const map: Record<string, number> = {};
    for (const op of stageOps) {
      if (!(op.operation_date in map)) {
        const ms = new Date(op.operation_date + "T00:00:00").getTime();
        map[op.operation_date] = Math.round((ms - firstDate) / 86_400_000) + 1;
      }
    }
    return map;
  }, [stageOps]);

  const visibleOps = useMemo(
    () => opTypeFilter ? stageOps.filter((op) => op.operation_type === opTypeFilter) : stageOps,
    [stageOps, opTypeFilter],
  );

  // which groups actually have ops in this stage (to show/hide filter buttons)
  const presentGroups = useMemo(
    () => new Set(stageOps.map((op) => op.operation_type)),
    [stageOps],
  );

  const fetchPhotosForOp = useCallback(async (operationId: string) => {
    try {
      const photos = await apiGet<Photo[]>(`/api/v1/plot-operations/${operationId}/photos`);
      setPhotosMap(prev => ({ ...prev, [operationId]: photos }));
    } catch { /* non-critical */ }
  }, []);

  const fetchOperations = useCallback(async (plotId: string) => {
    if (!plotId) { setOperations([]); setPhotosMap({}); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const data = await apiGet<PaginatedOps>("/api/v1/plot-operations", {
        plot_id: plotId,
        page_size: 100,
      });
      setOperations(data.items);
      setPhotosMap({});
      await Promise.all(data.items.map(op => fetchPhotosForOp(op.id)));
    } catch {
      setError(t("operations.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, fetchPhotosForOp]);

  const fetchPlots = useCallback(async () => {
    try {
      const d = await apiGet<PaginatedPlots>("/api/v1/plots?status=active&page_size=100");
      setPlots(d.items);
      if (d.items.length === 1) setSelectedPlotId(d.items[0].id);
    } catch {}
  }, []);

  const fetchSeasons = useCallback(async () => {
    try {
      const d = await apiGet<PaginatedFarmYears>("/api/v1/farm-years", { page_size: 100 });
      setFarmYears(d.items);
      setSelectedYearId((prev) => {
        if (prev && d.items.some((y) => y.id === prev)) return prev;
        return d.items[0]?.id ?? "";
      });
    } catch {}
  }, []);

  const ensureEnrollment = useCallback(async (farmYearId: string, plotId: string) => {
    try {
      return await apiPost<Enrollment>(`/api/v1/farm-years/${farmYearId}/plots`, {
        plot_id: plotId,
        farm_year_id: farmYearId,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const list = await apiGet<PaginatedEnrollments>(`/api/v1/farm-years/${farmYearId}/plots`, { page_size: 100 });
        const found = list.items.find((p) => p.plot_id === plotId);
        if (found) return found;
      }
      throw err;
    }
  }, []);

  useEffect(() => { fetchPlots(); fetchSeasons(); }, [fetchPlots, fetchSeasons]);
  useEffect(() => { fetchOperations(selectedPlotId); }, [selectedPlotId, fetchOperations]);

  useEffect(() => {
    stageTouched.current = false;
    setOpTypeFilter("");
  }, [selectedPlotId, selectedYearId]);

  useEffect(() => {
    setOpTypeFilter("");
  }, [lifecycleId]);

  useEffect(() => {
    let cancelled = false;
    async function loadEnrollment() {
      if (!selectedPlotId || !selectedYearId) {
        setEnrollment(null);
        setLifecycleId("");
        return;
      }
      try {
        const pfy = await ensureEnrollment(selectedYearId, selectedPlotId);
        if (cancelled) return;
        setEnrollment(pfy);
        const veg = pfy.lifecycles.find((lc) => lc.lifecycle_type === "vegetative");
        const fallback = veg?.id ?? pfy.lifecycles[0]?.id ?? "";
        if (!stageTouched.current) {
          const ids = new Set(pfy.lifecycles.map((lc) => lc.id));
          const last = operations.find((op) => op.plot_lifecycle_id && ids.has(op.plot_lifecycle_id));
          setLifecycleId(last?.plot_lifecycle_id ?? fallback);
        } else if (!pfy.lifecycles.some((lc) => lc.id === lifecycleId)) {
          setLifecycleId(fallback);
        }
      } catch {
        if (!cancelled) setEnrollment(null);
      }
    }
    loadEnrollment();
    return () => { cancelled = true; };
  }, [selectedPlotId, selectedYearId, ensureEnrollment, operations]);

  async function handleCreateSeason() {
    const year = Number(newSeasonYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
    setCreatingSeason(true);
    try {
      const fy = await apiPost<FarmYear>("/api/v1/farm-years", { year });
      setFarmYears((prev) => [fy, ...prev.filter((x) => x.id !== fy.id)].sort((a, b) => b.year - a.year));
      setSelectedYearId(fy.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const list = await apiGet<PaginatedFarmYears>("/api/v1/farm-years", { page_size: 100 });
        setFarmYears(list.items);
        const found = list.items.find((y) => y.year === year);
        if (found) setSelectedYearId(found.id);
      }
    } finally {
      setCreatingSeason(false);
    }
  }

  function openAdd() { setEditingOp(undefined); setShowForm(true); }
  function openEdit(op: PlotOperation) { setEditingOp(op); setShowForm(true); }
  function handleSaved() {
    setShowForm(false);
    stageTouched.current = false;
    fetchOperations(selectedPlotId);
    if (selectedYearId && selectedPlotId) {
      ensureEnrollment(selectedYearId, selectedPlotId).then(setEnrollment).catch(() => {});
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await apiDelete(`/api/v1/plot-operations/${id}`);
      setConfirmDeleteId(null);
      fetchOperations(selectedPlotId);
    } catch {
      setDeleting(false);
    }
  }

  const thStyle = {
    color: "var(--color-on-surface-variant)",
    borderBottom: "1px solid var(--color-outline-variant)",
    backgroundColor: "var(--color-surface-container-low)",
  };
  const tdStyle = {
    color: "var(--color-on-surface)",
    borderBottom: "1px solid var(--color-outline-variant)",
  };

  return (
    <>
      <title>{`${t("operations.pageTitle")} | LabourBook`}</title>

      {showForm && (
        <OpForm
          operation={editingOp}
          plots={plots}
          defaultPlotId={selectedPlotId}
          defaultDate={todayString()}
          lifecycles={lifecycles}
          defaultLifecycleId={lifecycleId}
          onSaved={handleSaved}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor:"var(--color-background)" }}>
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-label-caps mb-2" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.eyebrow")}</p>
              <h1 className="text-headline-lg" style={{ color:"var(--color-on-surface)", fontSize:"clamp(24px,5vw,32px)" }}>{t("operations.pageTitle")}</h1>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link href="/operations/year"
                className="h-12 px-4 rounded-xl text-body-md font-semibold flex items-center gap-2 hover:opacity-90 whitespace-nowrap"
                style={{ border:"1px solid var(--color-outline-variant)", color:"var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>timeline</span>
                {t("operations.yearOverview")}
              </Link>
              <button onClick={openAdd} disabled={!selectedPlotId || !lifecycleId} className="h-12 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2 hover:opacity-90 whitespace-nowrap disabled:opacity-50" style={{ backgroundColor:"var(--color-primary)", color:"var(--color-on-primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>add</span>
                {t("operations.addOperation")}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              <div>
                <label className="text-label-caps mb-1 block" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.selectPlot")}</label>
                <Select
                  value={selectedPlotId}
                  onChange={setSelectedPlotId}
                  placeholder={t("operations.plotPlaceholder")}
                  options={plots.map(p => ({ value: p.id, label: p.crop_name ? `${p.name} — ${p.crop_name}` : p.name }))}
                />
              </div>
              <div>
                <label className="text-label-caps mb-1 block" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.grapeYear")}</label>
                {farmYears.length > 0 ? (
                  <Select
                    value={selectedYearId}
                    onChange={setSelectedYearId}
                    placeholder={t("operations.selectYear")}
                    options={farmYears.map((y) => ({ value: y.id, label: seasonLabel(y.year) }))}
                    onAddNew={() => {
                      setNewSeasonYear(String(grapeYearOf()));
                      setSelectedYearId("");
                    }}
                    addNewLabel={t("operations.createSeason")}
                  />
                ) : (
                  <p className="text-body-md py-2" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.createSeasonHint")}</p>
                )}
              </div>
            </div>

            {(farmYears.length === 0 || selectedYearId === "") && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-label-caps mb-1 block" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.grapeYear")}</label>
                  <input
                    className="h-11 w-28 px-3 rounded-lg text-body-md"
                    style={{ border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)", color:"var(--color-on-surface)" }}
                    type="number"
                    min={2000}
                    max={2100}
                    value={newSeasonYear}
                    onChange={(e) => setNewSeasonYear(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateSeason}
                  disabled={creatingSeason}
                  className="h-11 px-5 rounded-xl text-body-md font-semibold"
                  style={{ backgroundColor:"var(--color-primary)", color:"var(--color-on-primary)" }}
                >
                  {creatingSeason ? t("operations.saving") : t("operations.createSeason")}
                </button>
              </div>
            )}

            {lifecycles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {lifecycles
                  .slice()
                  .sort((a, b) => {
                    if (a.lifecycle_type === b.lifecycle_type) return 0;
                    return a.lifecycle_type === "vegetative" ? -1 : 1;
                  })
                  .map((lc) => {
                    const selected = lifecycleId === lc.id;
                    const started = formatShort(lc.start_date);
                    return (
                      <button
                        key={lc.id}
                        type="button"
                        onClick={() => { stageTouched.current = true; setLifecycleId(lc.id); }}
                        className="min-h-11 px-4 py-2 rounded-xl text-left"
                        style={{
                          backgroundColor: selected ? "var(--color-primary)" : "var(--color-surface-container-low)",
                          color: selected ? "var(--color-on-primary)" : "var(--color-on-surface)",
                          border: `1px solid ${selected ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
                        }}
                      >
                        <span className="text-body-md font-semibold block">{stageTitle(lc, t)}</span>
                        <span className="text-label-caps" style={{ opacity: 0.85 }}>
                          {started ? `${t("operations.started")} ${started}` : t("operations.stageNotStarted")}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </header>

        <div className="px-4 md:px-8 pb-12">
          {(!selectedPlotId || !selectedYearId) && (
            <p className="text-body-md py-12 text-center" style={{ color:"var(--color-on-surface-variant)" }}>
              {!selectedPlotId ? t("operations.noPlotSelected") : t("operations.createSeasonHint")}
            </p>
          )}

          {selectedPlotId && selectedYearId && loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:"var(--color-primary)" }} />
            </div>
          )}

          {selectedPlotId && selectedYearId && !loading && error && (
            <div className="py-6 px-5 rounded-xl text-center" style={{ backgroundColor:"var(--color-error-container)", color:"var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={()=>fetchOperations(selectedPlotId)} className="px-5 py-2 rounded-lg text-body-md font-semibold" style={{ backgroundColor:"var(--color-on-error-container)", color:"var(--color-error-container)" }}>
                {t("operations.tryAgain")}
              </button>
            </div>
          )}

          {selectedPlotId && selectedYearId && !loading && !error && visibleOps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="material-symbols-outlined" style={{ fontSize:"64px", color:"var(--color-outline)" }}>agriculture</span>
              <div className="text-center">
                <p className="text-headline-md mb-1" style={{ color:"var(--color-on-surface)" }}>{t("operations.noOpsTitle")}</p>
                <p className="text-body-md" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.noOpsDesc")}</p>
              </div>
              <button onClick={openAdd} className="h-11 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2" style={{ backgroundColor:"var(--color-primary)", color:"var(--color-on-primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>add</span>
                {t("operations.addOperation")}
              </button>
            </div>
          )}

          {selectedPlotId && selectedYearId && !loading && !error && stageOps.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {(["", ...OP_GROUPS] as const).map((g) => {
                if (g !== "" && !presentGroups.has(g)) return null;
                const sel = opTypeFilter === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setOpTypeFilter(sel && g !== "" ? "" : g)}
                    className="h-8 px-3 rounded-full text-body-md font-semibold flex items-center gap-1.5"
                    style={{
                      backgroundColor: sel ? "var(--color-primary)" : "var(--color-surface-container-low)",
                      color: sel ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                      border: `1px solid ${sel ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
                    }}
                  >
                    {g !== "" && <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>{opGroupIcon(g)}</span>}
                    {g === "" ? t("common.all") : t(`operations.group.${g}`)}
                  </button>
                );
              })}
            </div>
          )}

          {selectedPlotId && selectedYearId && !loading && !error && visibleOps.length > 0 && (
            <div className="overflow-x-auto rounded-xl" style={{ border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)" }}>
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-label-caps font-semibold whitespace-nowrap w-16" style={thStyle}>{t("operations.colSno")}</th>
                    <th className="px-4 py-3 text-label-caps font-semibold" style={thStyle}>{t("operations.colOperationDone")}</th>
                    <th className="px-4 py-3 text-label-caps font-semibold whitespace-nowrap" style={thStyle}>{t("operations.colDate")}</th>
                    <th className="px-4 py-3 text-label-caps font-semibold whitespace-nowrap w-20" style={thStyle}>{t("operations.colDay")}</th>
                    <th className="px-4 py-3 text-label-caps font-semibold whitespace-nowrap" style={thStyle}>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOps.map((op, i) => (
                    <Fragment key={op.id}>
                      <tr>
                        <td className="px-4 py-3 text-body-md" style={tdStyle}>{i + 1}</td>
                        <td className="px-4 py-3 text-body-md" style={tdStyle}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-caps font-bold"
                              style={{
                                backgroundColor: op.operation_type === "spraying" ? "var(--color-tertiary-fixed)" : op.operation_type === "labour_work" ? "var(--color-primary-fixed)" : "var(--color-surface-container)",
                                color: op.operation_type === "spraying" ? "var(--color-tertiary)" : op.operation_type === "labour_work" ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                              }}>
                              <span className="material-symbols-outlined" style={{ fontSize:"12px" }}>{opGroupIcon(op.operation_type)}</span>
                              {displayOpType(op.operation_type, t)}
                            </span>
                            {op.notes && <span className="text-body-md font-semibold" style={{ color:"var(--color-on-surface)" }}>{op.notes}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-body-md whitespace-nowrap" style={tdStyle}>{formatTableDate(op.operation_date)}</td>
                        <td className="px-4 py-3 text-body-md font-semibold whitespace-nowrap" style={tdStyle}>
                          {dayNumberMap[op.operation_date] != null ? `Day ${dayNumberMap[op.operation_date]}` : "—"}
                        </td>
                        <td className="px-4 py-3" style={tdStyle}>
                          {confirmDeleteId === op.id ? (
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-body-md font-semibold" style={{ color:"var(--color-on-surface-variant)" }}>{t("common.cancel")}</button>
                              <button type="button" onClick={() => handleDelete(op.id)} disabled={deleting} className="text-body-md font-semibold" style={{ color:"var(--color-error)" }}>{deleting ? t("operations.deleting") : t("common.delete")}</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setExpandedId(expandedId === op.id ? null : op.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: expandedId === op.id || (photosMap[op.id]?.length ?? 0) > 0 ? "var(--color-primary)" : "var(--color-on-surface-variant)" }} aria-label={t("operations.photos")}>
                                <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>photo_camera</span>
                              </button>
                              <button type="button" onClick={() => openEdit(op)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color:"var(--color-on-surface-variant)" }} aria-label={t("common.edit")}>
                                <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>edit</span>
                              </button>
                              <button type="button" onClick={() => setConfirmDeleteId(op.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color:"var(--color-error)" }} aria-label={t("common.delete")}>
                                <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>delete</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedId === op.id && (
                        <tr>
                          <td colSpan={5} className="px-4 pb-4 pt-0" style={{ backgroundColor:"var(--color-surface-container-lowest)", borderBottom:"1px solid var(--color-outline-variant)" }}>
                            <PhotoStrip operationId={op.id} photos={photosMap[op.id] ?? []} onPhotosChanged={() => fetchPhotosForOp(op.id)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
