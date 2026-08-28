"use client";

import { useEffect, useState } from "react";
import { ApiError, apiPost, apiPatch } from "@/lib/api";
import { Team } from "@/types";

interface TeamModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  team?: Team | null; // null/undefined = create mode, value = edit mode
}

interface FormState {
  name: string;
  description: string;
  daily_wage: string;
  car_rent: string;
  manager_fee: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  daily_wage: "",
  car_rent: "0",
  manager_fee: "0",
};

function teamToForm(t: Team): FormState {
  return {
    name: t.name,
    description: t.description ?? "",
    daily_wage: String(t.daily_wage ?? 0),
    car_rent: String(t.car_rent ?? 0),
    manager_fee: String(t.manager_fee ?? 0),
  };
}

export default function TeamModal({ open, onClose, onSuccess, team }: TeamModalProps) {
  const isEdit = !!team;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form when modal opens/closes or team changes
  useEffect(() => {
    if (open) {
      setForm(team ? teamToForm(team) : EMPTY_FORM);
      setErrors({});
      setServerError(null);
    }
  }, [open, team]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Team name is required";
    if (!form.daily_wage || Number(form.daily_wage) <= 0) errs.daily_wage = "Daily wage is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      daily_wage: Number(form.daily_wage) || 0,
      car_rent: Number(form.car_rent) || 0,
      manager_fee: Number(form.manager_fee) || 0,
    };

    try {
      if (isEdit && team) {
        await apiPatch(`/api/v1/teams/${team.id}`, payload);
      } else {
        await apiPost("/api/v1/teams", payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string | { msg: string; loc?: string[] }[] } | null;
        if (Array.isArray(data?.detail)) {
          const fieldErrors: Record<string, string> = {};
          (data.detail as { msg: string; loc?: string[] }[]).forEach((d) => {
            const field = d.loc?.[d.loc.length - 1] ?? "general";
            fieldErrors[field] = d.msg;
          });
          setErrors(fieldErrors);
        } else {
          setServerError(
            typeof data?.detail === "string"
              ? data.detail
              : "Something went wrong. Please try again."
          );
        }
      } else {
        setServerError("Network error. Check your connection.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const inputStyle = (hasError: boolean) => ({
    backgroundColor: "var(--color-surface-container-lowest)",
    border: `1px solid ${hasError ? "var(--color-error)" : "var(--color-outline-variant)"}`,
    color: "var(--color-on-surface)",
    outline: "none",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex flex-col shadow-2xl"
          style={{
            width: "min(520px, 100%)",
            maxHeight: "90vh",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-outline-variant)",
            borderRadius: "var(--radius-lg)",
            pointerEvents: "auto",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={isEdit ? "Edit Team" : "Create Team"}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
          >
            <h2 className="text-headline-md" style={{ color: "var(--color-primary)" }}>
              {isEdit ? "Edit Team" : "Create Team"}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:opacity-70"
              style={{ color: "var(--color-on-surface-variant)" }}
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {serverError && (
              <div
                className="mb-5 px-4 py-3 rounded-lg text-body-md"
                style={{
                  backgroundColor: "var(--color-error-container)",
                  color: "var(--color-on-error-container)",
                }}
              >
                {serverError}
              </div>
            )}

            <form id="team-form" onSubmit={handleSubmit} noValidate>
              {/* Team Name */}
              <div className="mb-5">
                <label
                  htmlFor="team-name"
                  className="block text-label-caps mb-2"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  Team Name <span style={{ color: "var(--color-error)" }}>*</span>
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Shinde Group"
                  className="w-full h-12 px-4 rounded-lg text-body-md transition-colors"
                  style={inputStyle(!!errors.name)}
                />
                {errors.name && (
                  <p className="mt-1 text-label-caps" style={{ color: "var(--color-error)" }}>
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Daily Wage */}
              <div className="mb-5">
                <label
                  htmlFor="team-daily-wage"
                  className="block text-label-caps mb-2"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  Daily Wage per Labour (₹) <span style={{ color: "var(--color-error)" }}>*</span>
                </label>
                <input
                  id="team-daily-wage"
                  type="number"
                  value={form.daily_wage}
                  onChange={(e) => setField("daily_wage", e.target.value)}
                  placeholder="e.g. 350"
                  min={0}
                  className="w-full h-12 px-4 rounded-lg text-body-md transition-colors"
                  style={inputStyle(!!errors.daily_wage)}
                />
                {errors.daily_wage && (
                  <p className="mt-1 text-label-caps" style={{ color: "var(--color-error)" }}>
                    {errors.daily_wage}
                  </p>
                )}
              </div>

              {/* Car Rent + Manager Fee — side by side */}
              <div className="flex gap-4 mb-5">
                <div className="flex-1">
                  <label
                    htmlFor="team-car-rent"
                    className="block text-label-caps mb-2"
                    style={{ color: "var(--color-on-surface-variant)" }}
                  >
                    Car Rent (₹)
                  </label>
                  <input
                    id="team-car-rent"
                    type="number"
                    value={form.car_rent}
                    onChange={(e) => setField("car_rent", e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full h-12 px-4 rounded-lg text-body-md transition-colors"
                    style={inputStyle(false)}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="team-manager-fee"
                    className="block text-label-caps mb-2"
                    style={{ color: "var(--color-on-surface-variant)" }}
                  >
                    Manager Fee (₹)
                  </label>
                  <input
                    id="team-manager-fee"
                    type="number"
                    value={form.manager_fee}
                    onChange={(e) => setField("manager_fee", e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full h-12 px-4 rounded-lg text-body-md transition-colors"
                    style={inputStyle(false)}
                  />
                </div>
              </div>

              {/* Description (optional) */}
              <div className="mb-5">
                <label
                  htmlFor="team-description"
                  className="block text-label-caps mb-2"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  Description (optional)
                </label>
                <textarea
                  id="team-description"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Brief description of the team..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg text-body-md transition-colors resize-none"
                  style={{
                    backgroundColor: "var(--color-surface-container-lowest)",
                    border: "1px solid var(--color-outline-variant)",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Wage formula hint */}
              <div
                className="px-4 py-3 rounded-lg flex items-start gap-3"
                style={{
                  backgroundColor: "var(--color-surface-container-low)",
                  border: "1px solid var(--color-outline-variant)",
                }}
              >
                <span className="material-symbols-outlined mt-0.5" style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}>
                  info
                </span>
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)", textTransform: "none", fontWeight: 400 }}>
                  Total = No. of labours × Daily wage + Car rent + Manager fee
                </p>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-3 px-6 py-5"
            style={{ borderTop: "1px solid var(--color-outline-variant)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-lg text-body-md font-semibold transition-opacity hover:opacity-80"
              style={{
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface-variant)",
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              form="team-form"
              type="submit"
              disabled={submitting}
              className="h-10 px-6 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-on-primary)",
              }}
            >
              {submitting ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--color-on-primary)" }}
                  />
                  Saving…
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Team"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
