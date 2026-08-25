"use client";

import { useEffect, useState } from "react";
import { ApiError, apiPost, apiPatch } from "@/lib/api";
import { Labour } from "@/types";

interface LabourModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  labour?: Labour | null; // null/undefined = create mode, value = edit mode
}

interface FormState {
  name: string;
  hometown: string;
  phone: string;
  aadhaar: string;
  daily_wage: string;
  work_start_time: string;
  work_end_time: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  hometown: "",
  phone: "",
  aadhaar: "",
  daily_wage: "",
  work_start_time: "",
  work_end_time: "",
};

function labourToForm(l: Labour): FormState {
  return {
    name: l.name,
    hometown: l.hometown ?? "",
    phone: l.phone ?? "",
    aadhaar: l.aadhaar ?? "",
    daily_wage: String(l.daily_wage),
    work_start_time: l.work_start_time ?? "",
    work_end_time: l.work_end_time ?? "",
  };
}

export default function LabourModal({
  open,
  onClose,
  onSuccess,
  labour,
}: LabourModalProps) {
  const isEdit = !!labour;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form when drawer opens/closes or labour changes
  useEffect(() => {
    if (open) {
      setForm(labour ? labourToForm(labour) : EMPTY_FORM);
      setErrors({});
      setServerError(null);
    }
  }, [open, labour]);

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
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.daily_wage || isNaN(Number(form.daily_wage)) || Number(form.daily_wage) <= 0) {
      errs.daily_wage = "Enter a valid daily wage";
    }
    if (form.work_start_time && !/^\d{2}:\d{2}$/.test(form.work_start_time)) {
      errs.work_start_time = "Use HH:MM format";
    }
    if (form.work_end_time && !/^\d{2}:\d{2}$/.test(form.work_end_time)) {
      errs.work_end_time = "Use HH:MM format";
    }
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
      hometown: form.hometown.trim() || undefined,
      phone: form.phone.trim() || undefined,
      aadhaar: form.aadhaar.trim() || undefined,
      daily_wage: Number(form.daily_wage),
      work_start_time: form.work_start_time || undefined,
      work_end_time: form.work_end_time || undefined,
    };

    try {
      if (isEdit && labour) {
        await apiPatch(`/api/v1/labours/${labour.id}`, payload);
      } else {
        await apiPost("/api/v1/labours", payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string | { msg: string }[] } | null;
        if (Array.isArray(data?.detail)) {
          const fieldErrors: Record<string, string> = {};
          data.detail.forEach((d: { msg: string; loc?: string[] }) => {
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
          aria-label={isEdit ? "Edit Labour" : "Add Labour"}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
          >
            <h2 className="text-headline-md" style={{ color: "var(--color-primary)" }}>
              {isEdit ? "Edit Labour" : "Add Labour"}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
            {serverError && (
              <div
                className="px-4 py-3 rounded-lg text-body-md"
                style={{
                  backgroundColor: "var(--color-error-container)",
                  color: "var(--color-on-error-container)",
                }}
              >
                {serverError}
              </div>
            )}

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Name <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                id="labour-name"
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Deepak"
                className="h-11 px-3 rounded-lg text-body-md transition-colors"
                style={{
                  border: errors.name
                    ? "1px solid var(--color-error)"
                    : "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
              {errors.name && (
                <p className="text-label-caps" style={{ color: "var(--color-error)" }}>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Hometown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Hometown
              </label>
              <input
                id="labour-hometown"
                type="text"
                value={form.hometown}
                onChange={(e) => setField("hometown", e.target.value)}
                placeholder="e.g. Junnar"
                className="h-11 px-3 rounded-lg text-body-md transition-colors"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
            </div>

            {/* Daily Wage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Daily Wage (₹) <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                id="labour-daily-wage"
                type="number"
                min={1}
                step={1}
                value={form.daily_wage}
                onChange={(e) => setField("daily_wage", e.target.value)}
                placeholder="e.g. 400"
                className="h-11 px-3 rounded-lg text-body-md transition-colors"
                style={{
                  border: errors.daily_wage
                    ? "1px solid var(--color-error)"
                    : "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
              {errors.daily_wage && (
                <p className="text-label-caps" style={{ color: "var(--color-error)" }}>
                  {errors.daily_wage}
                </p>
              )}
            </div>

            {/* Work timing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  Start Time
                </label>
                <input
                  id="labour-start-time"
                  type="time"
                  value={form.work_start_time}
                  onChange={(e) => setField("work_start_time", e.target.value)}
                  className="h-11 px-3 rounded-lg text-body-md transition-colors"
                  style={{
                    border: errors.work_start_time
                      ? "1px solid var(--color-error)"
                      : "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
                {errors.work_start_time && (
                  <p className="text-label-caps" style={{ color: "var(--color-error)" }}>
                    {errors.work_start_time}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  End Time
                </label>
                <input
                  id="labour-end-time"
                  type="time"
                  value={form.work_end_time}
                  onChange={(e) => setField("work_end_time", e.target.value)}
                  className="h-11 px-3 rounded-lg text-body-md transition-colors"
                  style={{
                    border: errors.work_end_time
                      ? "1px solid var(--color-error)"
                      : "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Phone Number
              </label>
              <input
                id="labour-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="e.g. 98765 43210"
                className="h-11 px-3 rounded-lg text-body-md transition-colors"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
            </div>

            {/* Aadhaar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                Aadhaar Number
              </label>
              <input
                id="labour-aadhaar"
                type="text"
                value={form.aadhaar}
                onChange={(e) => setField("aadhaar", e.target.value)}
                placeholder="e.g. 1234 5678 9012"
                className="h-11 px-3 rounded-lg text-body-md transition-colors"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
            </div>
          </form>

          {/* Footer actions */}
          <div
            className="px-6 py-5 flex gap-3"
            style={{ borderTop: "1px solid var(--color-outline-variant)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-11 rounded-xl text-body-md font-semibold transition-colors"
              style={{
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface-variant)",
                backgroundColor: "transparent",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              onClick={handleSubmit}
              id="labour-modal-submit"
              className="flex-1 h-11 rounded-xl text-body-md font-semibold transition-opacity"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-on-primary)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Labour"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
