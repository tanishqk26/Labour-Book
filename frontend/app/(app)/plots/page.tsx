"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plot {
  id: string;
  name: string;
  size_acres: number;
  crop_name?: string;
  notes?: string;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PaginatedPlots {
  items: Plot[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// Plot Form Modal
// ---------------------------------------------------------------------------

interface PlotFormProps {
  plot?: Plot;
  onSaved: () => void;
  onClose: () => void;
}

function PlotForm({ plot, onSaved, onClose }: PlotFormProps) {
  const isEdit = !!plot;
  const [name, setName] = useState(plot?.name ?? "");
  const [sizeAcres, setSizeAcres] = useState(plot?.size_acres ? String(plot.size_acres) : "");
  const [cropName, setCropName] = useState(plot?.crop_name ?? "");
  const [notes, setNotes] = useState(plot?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Plot name is required."); return; }
    if (!sizeAcres || Number(sizeAcres) <= 0) { setError("Size must be greater than 0."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        size_acres: Number(sizeAcres),
        crop_name: cropName.trim() || null,
        notes: notes.trim() || null,
      };
      if (isEdit) {
        await apiPatch(`/api/v1/plots/${plot!.id}`, payload);
      } else {
        await apiPost("/api/v1/plots", payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setError(typeof data?.detail === "string" ? data.detail : "Failed to save plot.");
      } else {
        setError("Network error. Try again.");
      }
      setSubmitting(false);
    }
  }

  const inputCls = "w-full h-11 px-3 rounded-lg text-body-md";
  const inputStyle = {
    border: "1px solid var(--color-outline-variant)",
    backgroundColor: "var(--color-surface-container-lowest)",
    color: "var(--color-on-surface)",
    outline: "none",
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: "none" }}>
        <div className="flex flex-col shadow-2xl w-full" style={{ maxWidth: "460px", maxHeight: "90vh", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-lg)", pointerEvents: "auto" }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--color-primary-fixed)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-primary)" }}>landscape</span>
              </div>
              <h2 className="text-headline-md" style={{ color: "var(--color-primary)" }}>{isEdit ? "Edit Plot" : "Add Plot"}</h2>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70" style={{ color: "var(--color-on-surface-variant)" }}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {error && <p className="px-4 py-2 rounded-lg text-label-caps" style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-error)" }}>{error}</p>}

            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Plot Name *</label>
              <input className={inputCls} style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. North Field, Plot A" autoFocus />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Size (acres) *</label>
                <input className={inputCls} style={inputStyle} type="number" value={sizeAcres} onChange={e => setSizeAcres(e.target.value)} placeholder="e.g. 2.5" min={0.01} step={0.01} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Crop Name</label>
                <input className={inputCls} style={inputStyle} type="text" value={cropName} onChange={e => setCropName(e.target.value)} placeholder="e.g. Grapes, Wheat" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Notes (optional)</label>
              <textarea className="w-full px-3 py-2 rounded-lg text-body-md resize-none" style={{ ...inputStyle, height: "52px" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Location, soil type, or any other details..." />
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-body-md font-semibold" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>Cancel</button>
            <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={submitting} className="flex-1 h-11 rounded-xl text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
              {submitting ? <><span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "white" }} />Saving…</> : <><span className="material-symbols-outlined" style={{ fontSize: "18px" }}>save</span>{isEdit ? "Save Changes" : "Add Plot"}</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Plot Card
// ---------------------------------------------------------------------------

function PlotCard({ plot, onEdit, onDeleted }: { plot: Plot; onEdit: () => void; onDeleted: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/api/v1/plots/${plot.id}`);
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-xl p-5 flex flex-col gap-3 relative card-hover" style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-5 text-center" style={{ backgroundColor: "var(--color-error-container)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-error)" }}>delete_forever</span>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-error-container)" }}>Deactivate this plot?</p>
          <div className="flex gap-2 w-full">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 h-9 rounded-lg text-body-md font-semibold" style={{ border: "1px solid var(--color-on-error-container)", color: "var(--color-on-error-container)" }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 h-9 rounded-lg text-body-md font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--color-error)", color: "var(--color-on-error)" }}>{deleting ? "…" : "Deactivate"}</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--color-primary-fixed)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-primary)" }}>landscape</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-body-lg font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>{plot.name}</h3>
            {plot.crop_name && <p className="text-label-caps mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>{plot.crop_name}</p>}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }} aria-label="Edit">
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
          </button>
          <button onClick={() => setConfirmDelete(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80" style={{ border: "1px solid var(--color-error)", color: "var(--color-error)" }} aria-label="Delete">
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
          </button>
        </div>
      </div>

      {/* Size */}
      <div className="flex items-center gap-4 pt-3" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
        <div>
          <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Size</p>
          <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>{plot.size_acres} <span className="text-body-md font-normal">acres</span></p>
        </div>
        {plot.notes && (
          <p className="text-body-md flex-1 min-w-0 truncate" style={{ color: "var(--color-on-surface-variant)" }}>{plot.notes}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PlotsPage() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | undefined>(undefined);

  const fetchPlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<PaginatedPlots>("/api/v1/plots?status=active&page_size=100");
      setPlots(data.items);
      setTotal(data.total);
    } catch {
      setError("Failed to load plots.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlots(); }, [fetchPlots]);

  function openCreate() { setEditingPlot(undefined); setShowForm(true); }
  function openEdit(p: Plot) { setEditingPlot(p); setShowForm(true); }
  function handleSaved() { setShowForm(false); fetchPlots(); }

  const totalAcres = plots.reduce((s, p) => s + p.size_acres, 0);

  return (
    <>
      <title>Plots | LabourBook</title>

      {showForm && <PlotForm plot={editingPlot} onSaved={handleSaved} onClose={() => setShowForm(false)} />}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        {/* Header */}
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>FARM</p>
            <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", fontSize: "clamp(24px,5vw,32px)" }}>Plots</h1>
            <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>Manage your farm plots and fields.</p>
          </div>
          <button id="add-plot-btn" onClick={openCreate} className="h-12 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2 hover:opacity-90 whitespace-nowrap self-start sm:self-auto" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            Add Plot
          </button>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-6">
          {/* Summary */}
          {!loading && plots.length > 0 && (
            <div className="px-5 py-4 rounded-xl flex items-center gap-6 flex-wrap" style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}>
              <div>
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Total Plots</p>
                <p className="text-headline-md font-bold" style={{ color: "var(--color-on-surface)" }}>{total}</p>
              </div>
              <div className="w-px h-10 self-center" style={{ backgroundColor: "var(--color-outline-variant)" }} />
              <div>
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>Total Area</p>
                <p className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>{totalAcres.toFixed(2)} <span className="text-body-md font-normal">acres</span></p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="py-6 px-5 rounded-xl text-center" style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={fetchPlots} className="px-5 py-2 rounded-lg text-body-md font-semibold" style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}>Try Again</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-primary)" }} />
            </div>
          )}

          {/* Empty */}
          {!loading && !error && plots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)" }}>landscape</span>
              <div className="text-center">
                <p className="text-headline-md mb-1" style={{ color: "var(--color-on-surface)" }}>No plots yet</p>
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Add your first farm plot to get started.</p>
              </div>
              <button onClick={openCreate} className="h-11 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>Add Plot
              </button>
            </div>
          )}

          {/* Grid */}
          {!loading && !error && plots.length > 0 && (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {plots.map(p => (
                <PlotCard key={p.id} plot={p} onEdit={() => openEdit(p)} onDeleted={fetchPlots} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
