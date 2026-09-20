"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { apiFetch, apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plot { id: string; name: string; crop_name?: string | null; }

interface LifecycleSummary { id: string; lifecycle_type: string; name: string; }

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

interface Worker {
  id: string;
  operation_id: string;
  labour_id: string | null;
  team_id: string | null;
  hours_worked: number | null;
  labour: { id: string; name: string; daily_wage: number } | null;
  team:   { id: string; name: string; daily_wage: number; car_rent: number; manager_fee: number } | null;
}

interface SimpleLabour { id: string; name: string; hometown: string | null; }
interface SimpleTeam   { id: string; name: string; }
interface PaginatedLabours { items: SimpleLabour[]; }
interface PaginatedTeams   { items: SimpleTeam[]; }

interface PaginatedOps { items: PlotOperation[]; total: number; has_more: boolean; }
interface PaginatedPlots { items: Plot[]; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OP_TYPE_ICON: Record<string, string> = {
  irrigation: "water_drop", fertilizer: "compost", pesticide: "pest_control",
  fungicide: "science", insecticide: "pest_control", leaf_removal: "yard",
  shoot_management: "cut", weeding: "grass", bunch_management: "category",
  harvest: "agriculture", other: "more_horiz",
};
const OP_TYPE_COLOR: Record<string, string> = {
  irrigation: "#2196F3", fertilizer: "#8BC34A", pesticide: "#FF5722",
  fungicide: "#9C27B0", insecticide: "#E91E63", leaf_removal: "#4CAF50",
  shoot_management: "#009688", weeding: "#FF9800", bunch_management: "#673AB7",
  harvest: "#F9A825", other: "#607D8B",
};
const OP_TYPES = [
  "irrigation","fertilizer","pesticide","fungicide","insecticide",
  "leaf_removal","shoot_management","weeding","bunch_management","harvest","other",
];
const MAX_PHOTOS = 5;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayString() { return toLocalDateString(new Date()); }
function shiftDate(s: string, days: number) {
  const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + days); return toLocalDateString(d);
}
function formatDisplayDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short", year:"numeric" });
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
// WorkerPicker — inline in the Add/Edit form
// ---------------------------------------------------------------------------

interface WorkerEntry {
  key: string;          // temp client-side key
  type: "labour" | "team";
  id: string;
  name: string;
  hours: string;        // string so input stays controlled
}

function WorkerPicker({
  labours,
  teams,
  workers,
  onChange,
}: {
  labours: SimpleLabour[];
  teams: SimpleTeam[];
  workers: WorkerEntry[];
  onChange: (workers: WorkerEntry[]) => void;
}) {
  const [type,  setType]  = useState<"labour" | "team">("labour");
  const [selId, setSelId] = useState("");
  const [hours, setHours] = useState("");

  function addWorker() {
    if (!selId) return;
    const list = type === "labour" ? labours : teams;
    const found = list.find(x => x.id === selId);
    if (!found) return;
    // No duplicates
    if (workers.some(w => w.id === selId && w.type === type)) return;
    onChange([...workers, { key: `${type}-${selId}`, type, id: selId, name: found.name, hours }]);
    setSelId(""); setHours("");
  }

  function remove(key: string) { onChange(workers.filter(w => w.key !== key)); }
  function setWorkerHours(key: string, h: string) {
    onChange(workers.map(w => w.key === key ? { ...w, hours: h } : w));
  }

  const inputBase = "h-9 px-3 rounded-lg text-body-md";
  const inputStyle = { border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)", color:"var(--color-on-surface)", outline:"none" };

  return (
    <div className="flex flex-col gap-2">
      {/* Row selector */}
      <div className="flex gap-2 items-center">
        {/* Labour / Team toggle */}
        <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border:"1px solid var(--color-outline-variant)" }}>
          {(["labour","team"] as const).map(t => (
            <button key={t} type="button" onClick={()=>{setType(t);setSelId("");}}
              className="h-9 px-3 text-label-caps font-semibold"
              style={{ backgroundColor: type===t ? "var(--color-primary)" : "transparent", color: type===t ? "var(--color-on-primary)" : "var(--color-on-surface-variant)" }}>
              {t === "labour" ? "Labour" : "Team"}
            </button>
          ))}
        </div>

        {/* Select dropdown */}
        <select className={`flex-1 ${inputBase}`} style={inputStyle} value={selId} onChange={e=>setSelId(e.target.value)}>
          <option value="">Select {type === "labour" ? "labour" : "team"}…</option>
          {(type === "labour" ? labours : teams).map(x => (
            <option key={x.id} value={x.id}
              disabled={workers.some(w=>w.id===x.id&&w.type===type)}>
              {x.name}
            </option>
          ))}
        </select>

        {/* Hours input */}
        <input type="number" min="0.5" max="24" step="0.5" className={`w-20 ${inputBase}`} style={inputStyle}
          placeholder="hrs" value={hours} onChange={e=>setHours(e.target.value)} />

        {/* Add button */}
        <button type="button" onClick={addWorker} disabled={!selId}
          className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40"
          style={{ backgroundColor:"var(--color-primary)", color:"var(--color-on-primary)" }}>
          <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>add</span>
        </button>
      </div>

      {/* Chips */}
      {workers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {workers.map(w => (
            <div key={w.key} className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor:"var(--color-primary-fixed)", border:"1px solid var(--color-outline-variant)" }}>
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize:"16px", color:"var(--color-primary)" }}>
                {w.type === "labour" ? "person" : "group_work"}
              </span>
              <span className="flex-1 text-body-md font-semibold truncate" style={{ color:"var(--color-on-surface)" }}>{w.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <input type="number" min="0.5" max="24" step="0.5"
                  className="w-16 h-7 px-2 rounded text-body-md text-center"
                  style={{ border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)", color:"var(--color-on-surface)", outline:"none" }}
                  placeholder="hrs"
                  value={w.hours} onChange={e=>setWorkerHours(w.key, e.target.value)} />
                <span className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>hrs</span>
              </div>
              <button type="button" onClick={()=>remove(w.key)}
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ color:"var(--color-error)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit Operation Modal
// ---------------------------------------------------------------------------

interface OpFormProps {
  operation?: PlotOperation;
  plots: Plot[];
  labours: SimpleLabour[];
  teams: SimpleTeam[];
  defaultDate: string;
  onSaved: () => void;
  onClose: () => void;
}

function OpForm({ operation, plots, labours, teams, defaultDate, onSaved, onClose }: OpFormProps) {
  const { t } = useLanguage();
  const isEdit = !!operation;
  const [plotId, setPlotId] = useState(operation?.plot_id ?? "");
  const [opType, setOpType] = useState(operation?.operation_type ?? "");
  const [opDate, setOpDate] = useState(operation?.operation_date ?? defaultDate);
  const [notes, setNotes] = useState(operation?.notes ?? "");
  const [pendingWorkers, setPendingWorkers] = useState<WorkerEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plotId) { setError("Please select a plot."); return; }
    if (!opType) { setError("Please select an operation type."); return; }
    setSubmitting(true); setError(null);
    try {
      const payload = { plot_id: plotId, operation_type: opType, operation_date: opDate, notes: notes.trim() || null };
      let opId: string;
      if (isEdit) {
        await apiPatch(`/api/v1/plot-operations/${operation!.id}`, payload);
        opId = operation!.id;
      } else {
        const created = await apiPost<PlotOperation>("/api/v1/plot-operations", payload);
        opId = created.id;
      }
      // Add pending workers (fire-and-forget per entry; errors are non-critical)
      await Promise.allSettled(
        pendingWorkers.map(w =>
          apiPost(`/api/v1/plot-operations/${opId}/workers`, {
            labour_id: w.type === "labour" ? w.id : null,
            team_id:   w.type === "team"   ? w.id : null,
            hours_worked: w.hours ? parseFloat(w.hours) : null,
          })
        )
      );
      onSaved();
    } catch (err) {
      const d = err instanceof ApiError ? (err.data as {detail?:string}|null) : null;
      setError(typeof d?.detail === "string" ? d.detail : t("operations.saveError"));
      setSubmitting(false);
    }
  }

  const inputCls = "w-full h-11 px-3 rounded-lg text-body-md";
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
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.plotLabel")}</label>
              <select className={inputCls} style={inputStyle} value={plotId} onChange={e=>setPlotId(e.target.value)}>
                <option value="">{t("operations.plotPlaceholder")}</option>
                {plots.map(p=><option key={p.id} value={p.id}>{p.name}{p.crop_name ? ` — ${p.crop_name}` : ""}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.opTypeLabel")}</label>
              <select className={inputCls} style={inputStyle} value={opType} onChange={e=>setOpType(e.target.value)}>
                <option value="">{t("operations.opTypePlaceholder")}</option>
                {OP_TYPES.map(ot=><option key={ot} value={ot}>{t(`operations.type.${ot}`)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.dateLabel")}</label>
              <input className={inputCls} style={inputStyle} type="date" value={opDate} onChange={e=>setOpDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.notesLabel")}</label>
              <textarea className="w-full px-3 py-2 rounded-lg text-body-md resize-none" style={{ ...inputStyle, height:"72px" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t("operations.notesPlaceholder")} />
            </div>

            {/* Workers */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>Workers Involved (optional)</label>
              <WorkerPicker labours={labours} teams={teams} workers={pendingWorkers} onChange={setPendingWorkers} />
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
// Operation row
// ---------------------------------------------------------------------------

function OperationRow({
  op,
  photos,
  workers,
  onEdit,
  onDeleted,
  onPhotosChanged,
  onWorkersChanged,
}: {
  op: PlotOperation;
  photos: Photo[];
  workers: Worker[];
  onEdit: () => void;
  onDeleted: () => void;
  onPhotosChanged: () => void;
  onWorkersChanged: () => void;
}) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);

  const icon  = OP_TYPE_ICON[op.operation_type]  ?? "more_horiz";
  const color = OP_TYPE_COLOR[op.operation_type] ?? "#607D8B";

  async function handleDelete() {
    setDeleting(true);
    try { await apiDelete(`/api/v1/plot-operations/${op.id}`); onDeleted(); }
    catch { setDeleting(false); setConfirmDelete(false); }
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor:"var(--color-error-container)" }}>
        <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize:"20px", color:"var(--color-error)" }}>delete_forever</span>
        <p className="flex-1 text-body-md font-semibold" style={{ color:"var(--color-on-error-container)" }}>{t("operations.deleteConfirm")}</p>
        <button onClick={()=>setConfirmDelete(false)} className="h-8 px-3 rounded-lg text-body-md font-semibold" style={{ border:"1px solid var(--color-on-error-container)", color:"var(--color-on-error-container)" }}>{t("common.cancel")}</button>
        <button onClick={handleDelete} disabled={deleting} className="h-8 px-3 rounded-lg text-body-md font-semibold disabled:opacity-50" style={{ backgroundColor:"var(--color-error)", color:"var(--color-on-error)" }}>
          {deleting ? t("operations.deleting") : t("common.delete")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border:"1px solid var(--color-outline-variant)" }}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3 group" style={{ backgroundColor:"var(--color-surface-container-lowest)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor:`${color}18` }}>
          <span className="material-symbols-outlined" style={{ fontSize:"18px", color }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body-md font-semibold" style={{ color:"var(--color-on-surface)" }}>{t(`operations.type.${op.operation_type}`)}</span>
            {op.lifecycle && (
              <span className="px-2 py-0.5 rounded-full text-label-caps" style={{ backgroundColor:"var(--color-secondary-fixed)", color:"var(--color-on-secondary-fixed)" }}>
                {op.lifecycle.lifecycle_type === "vegetative" ? "VEG" : "PROD"}
              </span>
            )}
            {photos.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-label-caps flex items-center gap-1" style={{ backgroundColor:"var(--color-tertiary-fixed)", color:"var(--color-on-tertiary-fixed)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"11px" }}>photo</span>
                {photos.length}
              </span>
            )}
          </div>
          {op.notes && <p className="text-body-md mt-0.5 line-clamp-2" style={{ color:"var(--color-on-surface-variant)" }}>{op.notes}</p>}
          {/* Worker chips + estimated cost */}
          {workers.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {(() => {
                // Labour cost: existing rule = daily_wage per worker (full-day rate; system has no hourly rate)
                const labourCost = workers
                  .filter(w => w.labour_id)
                  .reduce((sum, w) => sum + (w.labour?.daily_wage ?? 0), 0);
                // Team cost: requires num_labourers which is not stored — show rates only
                const teamWorkers = workers.filter(w => w.team_id);
                const totalEstimate = labourCost; // teams excluded from sum (see below)

                return (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {workers.map(w => {
                        const isTeam = !!w.team_id;
                        const name = w.labour?.name ?? w.team?.name ?? "—";
                        // Cost display for this entry
                        const costLabel = isTeam
                          ? null // team: no total, show rates separately
                          : w.labour
                          ? `₹${w.labour.daily_wage.toLocaleString()}`
                          : null;

                        return (
                          <span key={w.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-label-caps"
                            style={{ backgroundColor:"var(--color-secondary-fixed)", color:"var(--color-on-secondary-fixed)" }}>
                            <span className="material-symbols-outlined" style={{ fontSize:"11px" }}>
                              {isTeam ? "group_work" : "person"}
                            </span>
                            {name}
                            {w.hours_worked != null && <span style={{ opacity:0.7 }}> · {w.hours_worked}h</span>}
                            {costLabel && <span className="font-bold" style={{ color:"var(--color-primary)" }}> · {costLabel}</span>}
                          </span>
                        );
                      })}
                    </div>

                    {/* Team rate breakdown (no computable total — headcount not stored) */}
                    {teamWorkers.map(w => w.team && (
                      <p key={w.id} className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>
                        <span className="material-symbols-outlined align-middle" style={{ fontSize:"11px" }}>info</span>
                        {" "}{w.team.name}: ₹{w.team.daily_wage.toLocaleString()}/person + ₹{w.team.car_rent.toLocaleString()} car + ₹{w.team.manager_fee.toLocaleString()} mgr — headcount needed for total
                      </p>
                    ))}

                    {/* Labour total */}
                    {labourCost > 0 && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>
                          {teamWorkers.length > 0 ? "Est. labour cost (individuals)" : "Est. labour cost"}:
                        </span>
                        <span className="text-body-md font-bold" style={{ color:"var(--color-primary)" }}>
                          ₹{labourCost.toLocaleString()}
                        </span>
                        <span className="text-label-caps" style={{ color:"var(--color-on-surface-variant)", opacity:0.6 }}>
                          (daily rate)
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={()=>setShowPhotos(s=>!s)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80" style={{ border:"1px solid var(--color-outline-variant)", color: showPhotos ? "var(--color-primary)" : "var(--color-on-surface-variant)" }} aria-label="Photos">
            <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>photo_camera</span>
          </button>
          <button onClick={onEdit} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80" style={{ border:"1px solid var(--color-outline-variant)", color:"var(--color-on-surface-variant)" }} aria-label="Edit">
            <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>edit</span>
          </button>
          <button onClick={()=>setConfirmDelete(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80" style={{ border:"1px solid var(--color-error)", color:"var(--color-error)" }} aria-label="Delete">
            <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>delete</span>
          </button>
        </div>
      </div>

      {/* Photo strip — always visible if photos exist, toggled otherwise */}
      {(showPhotos || photos.length > 0) && (
        <div className="px-4 pb-3 pt-2" style={{ borderTop:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)" }}>
          <PhotoStrip
            operationId={op.id}
            photos={photos}
            onPhotosChanged={onPhotosChanged}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plot group card
// ---------------------------------------------------------------------------

function PlotGroup({ plotId, plotName, cropName, ops, photosMap, workersMap, onEdit, onDeleted, onPhotosChanged, onWorkersChanged }: {
  plotId: string; plotName: string; cropName?: string | null;
  ops: PlotOperation[];
  photosMap: Record<string, Photo[]>;
  workersMap: Record<string, Worker[]>;
  onEdit: (op: PlotOperation) => void;
  onDeleted: () => void;
  onPhotosChanged: (opId: string) => void;
  onWorkersChanged: (opId: string) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-low)" }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom:"1px solid var(--color-outline-variant)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor:"var(--color-primary-fixed)" }}>
          <span className="material-symbols-outlined" style={{ fontSize:"18px", color:"var(--color-primary)" }}>landscape</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body-lg font-semibold" style={{ color:"var(--color-on-surface)" }}>{plotName}</h3>
          {cropName && <p className="text-label-caps" style={{ color:"var(--color-on-surface-variant)" }}>{cropName}</p>}
        </div>
        <span className="text-label-caps px-2.5 py-1 rounded-full" style={{ backgroundColor:"var(--color-primary-fixed)", color:"var(--color-primary)" }}>
          {ops.length} op{ops.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {ops.map(op => (
          <OperationRow
            key={op.id}
            op={op}
            photos={photosMap[op.id] ?? []}
            workers={workersMap[op.id] ?? []}
            onEdit={() => onEdit(op)}
            onDeleted={onDeleted}
            onPhotosChanged={() => onPhotosChanged(op.id)}
            onWorkersChanged={() => onWorkersChanged(op.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OperationsPage() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [operations, setOperations]     = useState<PlotOperation[]>([]);
  const [photosMap, setPhotosMap]       = useState<Record<string, Photo[]>>({});
  const [workersMap, setWorkersMap]     = useState<Record<string, Worker[]>>({});
  const [plots, setPlots]               = useState<Plot[]>([]);
  const [labours, setLabours]           = useState<SimpleLabour[]>([]);
  const [teams, setTeams]               = useState<SimpleTeam[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [editingOp, setEditingOp]       = useState<PlotOperation | undefined>(undefined);

  const plotMap = useMemo(() => { const m: Record<string,Plot>={}; plots.forEach(p=>{m[p.id]=p;}); return m; }, [plots]);
  const grouped = useMemo(() => { const g: Record<string,PlotOperation[]>={}; operations.forEach(op=>{ if(!g[op.plot_id])g[op.plot_id]=[]; g[op.plot_id].push(op); }); return g; }, [operations]);
  const isToday = selectedDate === todayString();

  const fetchPhotosForOp = useCallback(async (operationId: string) => {
    try {
      const photos = await apiGet<Photo[]>(`/api/v1/plot-operations/${operationId}/photos`);
      setPhotosMap(prev => ({ ...prev, [operationId]: photos }));
    } catch { /* non-critical */ }
  }, []);

  const fetchWorkersForOp = useCallback(async (operationId: string) => {
    try {
      const workers = await apiGet<Worker[]>(`/api/v1/plot-operations/${operationId}/workers`);
      setWorkersMap(prev => ({ ...prev, [operationId]: workers }));
    } catch { /* non-critical */ }
  }, []);

  const fetchOperations = useCallback(async (date: string) => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet<PaginatedOps>("/api/v1/plot-operations", { date_from: date, date_to: date, page_size: 100 });
      setOperations(data.items);
      setPhotosMap({}); setWorkersMap({});
      await Promise.all([
        ...data.items.map(op => fetchPhotosForOp(op.id)),
        ...data.items.map(op => fetchWorkersForOp(op.id)),
      ]);
    } catch {
      setError(t("operations.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, fetchPhotosForOp, fetchWorkersForOp]);

  const fetchPlots = useCallback(async () => {
    try { const d = await apiGet<PaginatedPlots>("/api/v1/plots?status=active&page_size=100"); setPlots(d.items); } catch {}
  }, []);

  const fetchLaboursAndTeams = useCallback(async () => {
    try {
      const [ld, td] = await Promise.all([
        apiGet<PaginatedLabours>("/api/v1/labours?status=active&page_size=100"),
        apiGet<PaginatedTeams>("/api/v1/teams?status=active&page_size=100"),
      ]);
      setLabours(ld.items);
      setTeams(td.items);
    } catch { /* non-critical — form dropdown will be empty */ }
  }, []);

  useEffect(() => { fetchPlots(); fetchLaboursAndTeams(); }, [fetchPlots, fetchLaboursAndTeams]);
  useEffect(() => { fetchOperations(selectedDate); }, [selectedDate, fetchOperations]);

  function goToToday() { setSelectedDate(todayString()); }
  function prevDay()   { setSelectedDate(d => shiftDate(d, -1)); }
  function nextDay()   { setSelectedDate(d => shiftDate(d, +1)); }
  function openAdd()   { setEditingOp(undefined); setShowForm(true); }
  function openEdit(op: PlotOperation) { setEditingOp(op); setShowForm(true); }
  function handleSaved() { setShowForm(false); fetchOperations(selectedDate); }

  const plotIds = Object.keys(grouped);

  return (
    <>
      <title>{`${t("operations.pageTitle")} | LabourBook`}</title>

      {showForm && (
        <OpForm operation={editingOp} plots={plots} labours={labours} teams={teams} defaultDate={selectedDate} onSaved={handleSaved} onClose={() => setShowForm(false)} />
      )}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor:"var(--color-background)" }}>
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-label-caps mb-2" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.eyebrow")}</p>
              <h1 className="text-headline-lg" style={{ color:"var(--color-on-surface)", fontSize:"clamp(24px,5vw,32px)" }}>{t("operations.pageTitle")}</h1>
              <p className="text-body-md mt-1" style={{ color:"var(--color-on-surface-variant)" }}>{t("operations.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link href="/operations/year"
                className="h-12 px-4 rounded-xl text-body-md font-semibold flex items-center gap-2 hover:opacity-90 whitespace-nowrap"
                style={{ border:"1px solid var(--color-outline-variant)", color:"var(--color-on-surface-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>timeline</span>
                {t("operations.yearOverview")}
              </Link>
              <button onClick={openAdd} className="h-12 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2 hover:opacity-90 whitespace-nowrap" style={{ backgroundColor:"var(--color-primary)", color:"var(--color-on-primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>add</span>
                {t("operations.addOperation")}
              </button>
            </div>
          </div>

          {/* Date navigator */}
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <button onClick={prevDay} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ border:"1px solid var(--color-outline-variant)", color:"var(--color-on-surface-variant)" }} aria-label="Previous day">
              <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>chevron_left</span>
            </button>
            <label className="relative flex items-center gap-2 h-9 px-4 rounded-xl cursor-pointer select-none" style={{ border:"1px solid var(--color-outline-variant)", backgroundColor:"var(--color-surface-container-lowest)", color:"var(--color-on-surface)" }}>
              <span className="material-symbols-outlined" style={{ fontSize:"18px", color:"var(--color-primary)" }}>calendar_today</span>
              <span className="text-body-md font-semibold">{formatDisplayDate(selectedDate)}</span>
              <input type="date" value={selectedDate} onChange={e=>e.target.value&&setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
            </label>
            <button onClick={nextDay} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ border:"1px solid var(--color-outline-variant)", color:"var(--color-on-surface-variant)" }} aria-label="Next day">
              <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>chevron_right</span>
            </button>
            {!isToday && (
              <button onClick={goToToday} className="h-9 px-4 rounded-xl text-body-md font-semibold" style={{ backgroundColor:"var(--color-primary-fixed)", color:"var(--color-primary)" }}>
                {t("operations.today")}
              </button>
            )}
            {!loading && operations.length > 0 && (
              <span className="ml-auto text-label-caps px-3 py-1 rounded-full" style={{ backgroundColor:"var(--color-secondary-container)", color:"var(--color-on-secondary-container)" }}>
                {operations.length} operation{operations.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </header>

        {/* ── Content ───────────────────────────────────────── */}
        <div className="px-4 md:px-8 pb-12 flex flex-col gap-4">
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:"var(--color-primary)" }} />
            </div>
          )}
          {!loading && error && (
            <div className="py-6 px-5 rounded-xl text-center" style={{ backgroundColor:"var(--color-error-container)", color:"var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={()=>fetchOperations(selectedDate)} className="px-5 py-2 rounded-lg text-body-md font-semibold" style={{ backgroundColor:"var(--color-on-error-container)", color:"var(--color-error-container)" }}>
                {t("operations.tryAgain")}
              </button>
            </div>
          )}
          {!loading && !error && operations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
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
          {!loading && !error && plotIds.length > 0 && (
            <div className="flex flex-col gap-4">
              {plotIds.map(plotId => (
                <PlotGroup
                  key={plotId}
                  plotId={plotId}
                  plotName={plotMap[plotId]?.name ?? plotId}
                  cropName={plotMap[plotId]?.crop_name}
                  ops={grouped[plotId]}
                  photosMap={photosMap}
                  workersMap={workersMap}
                  onEdit={openEdit}
                  onDeleted={() => fetchOperations(selectedDate)}
                  onPhotosChanged={fetchPhotosForOp}
                  onWorkersChanged={fetchWorkersForOp}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
