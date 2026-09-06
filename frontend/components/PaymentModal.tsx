"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { Labour, TeamSummary, PaginatedResponse, EntityPaymentSummary } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-select a specific entity */
  preselectedEntityType?: "individual" | "team";
  preselectedEntityId?: string;
}

type PaymentMethod = "cash" | "upi" | "bank_transfer" | "other";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: "payments",
  upi: "qr_code_scanner",
  bank_transfer: "account_balance",
  other: "receipt",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentModal({
  open,
  onClose,
  onSuccess,
  preselectedEntityType,
  preselectedEntityId,
}: PaymentModalProps) {
  const [entityType, setEntityType] = useState<"individual" | "team">("individual");
  const [entityId, setEntityId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());

  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Entity KPI (fetched when entity is selected)
  const [entitySummary, setEntitySummary] = useState<EntityPaymentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Load labours & teams on open
  useEffect(() => {
    if (!open) return;

    // Reset form
    setEntityType(preselectedEntityType ?? "individual");
    setEntityId(preselectedEntityId ?? "");
    setEntitySummary(null);
    setAmount("");
    setMethod("cash");
    setNotes("");
    setDate(todayISO());
    setErrors({});
    setServerError(null);

    async function loadEntities() {
      setLoadingEntities(true);
      try {
        const [labourData, teamData] = await Promise.all([
          apiGet<PaginatedResponse<Labour>>("/api/v1/labours", { status: "active", page_size: 100 }),
          apiGet<PaginatedResponse<TeamSummary>>("/api/v1/teams", { status: "active", page_size: 100 }),
        ]);
        setLabours(labourData.items);
        setTeams(teamData.items);
      } catch {
        // silently ignore — user will see empty dropdowns
      } finally {
        setLoadingEntities(false);
      }
    }
    loadEntities();
  }, [open, preselectedEntityType, preselectedEntityId]);

  // Fetch entity summary whenever entityId or entityType changes
  useEffect(() => {
    if (!entityId) {
      setEntitySummary(null);
      return;
    }
    const typeParam = entityType === "individual" ? "individual" : "team";
    setSummaryLoading(true);
    apiGet<EntityPaymentSummary>(`/api/v1/payments/entity/${typeParam}/${entityId}/summary`)
      .then((data) => setEntitySummary(data))
      .catch(() => setEntitySummary(null))
      .finally(() => setSummaryLoading(false));
  }, [entityId, entityType]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!entityId) errs.entity = "Please select a labour or team";
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      errs.amount = "Enter a valid amount greater than 0";
    }
    if (!date) errs.date = "Date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const payload: Record<string, unknown> = {
      amount: Number(amount),
      method,
      date,
      notes: notes.trim() || undefined,
    };

    if (entityType === "individual") {
      payload.labour_id = entityId;
    } else {
      payload.team_id = entityId;
    }

    try {
      await apiPost("/api/v1/payments", payload);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string | { msg: string }[] } | null;
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

  const entities = entityType === "individual" ? labours : teams;
  const entityOptions = entities.map((e) => ({ id: e.id, name: e.name }));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal wrapper */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Note Payment"
      >
        <div
          className="w-full sm:max-w-lg flex flex-col shadow-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-outline-variant)",
            borderRadius: "24px 24px 0 0",
            maxHeight: "95vh",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-5 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary-fixed)" }}
              >
                <span
                  className="material-symbols-outlined icon-fill"
                  style={{ fontSize: "18px", color: "var(--color-primary)" }}
                >
                  payments
                </span>
              </div>
              <h2 className="text-headline-md font-bold" style={{ color: "var(--color-primary)" }}>
                Note Payment
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "var(--color-on-surface-variant)" }}
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5"
          >
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

            {/* Entity type selector */}
            <div className="flex flex-col gap-2">
              <label
                className="text-label-caps"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Pay to
              </label>
              <div
                className="flex rounded-xl p-1 gap-1"
                style={{
                  backgroundColor: "var(--color-surface-container-low)",
                  border: "1px solid var(--color-outline-variant)",
                }}
              >
                {(["individual", "team"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setEntityType(t);
                      setEntityId("");
                      setEntitySummary(null);
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.entity;
                        return next;
                      });
                    }}
                    className="flex-1 h-9 rounded-lg text-body-md font-semibold flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      backgroundColor: entityType === t ? "var(--color-primary)" : "transparent",
                      color:
                        entityType === t
                          ? "var(--color-on-primary)"
                          : "var(--color-on-surface-variant)",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      {t === "individual" ? "person" : "groups"}
                    </span>
                    {t === "individual" ? "Labour" : "Team"}
                  </button>
                ))}
              </div>
            </div>

            {/* Entity selector */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-label-caps"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Select {entityType === "individual" ? "Labour" : "Team"}{" "}
                <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              {loadingEntities ? (
                <div
                  className="h-11 rounded-lg flex items-center px-3 gap-2"
                  style={{
                    border: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                    style={{ borderColor: "var(--color-primary)" }}
                  />
                  <span className="text-body-md">Loading…</span>
                </div>
              ) : (
                <select
                  id="payment-entity-select"
                  value={entityId}
                  onChange={(e) => {
                    setEntityId(e.target.value);
                    setEntitySummary(null);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.entity;
                      return next;
                    });
                  }}
                  className="h-11 px-3 rounded-lg text-body-md transition-colors"
                  style={{
                    border: errors.entity
                      ? "1px solid var(--color-error)"
                      : "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                    color: entityId
                      ? "var(--color-on-surface)"
                      : "var(--color-on-surface-variant)",
                    outline: "none",
                  }}
                >
                  <option value="">
                    — Choose {entityType === "individual" ? "Labour" : "Team"} —
                  </option>
                  {entityOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              )}
              {errors.entity && (
                <p className="text-label-caps" style={{ color: "var(--color-error)" }}>
                  {errors.entity}
                </p>
              )}
            </div>

            {/* Entity KPI summary — shown once entity is selected */}
            {(summaryLoading || entitySummary) && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  backgroundColor: "var(--color-surface-container-low)",
                  border: "1px solid var(--color-outline-variant)",
                }}
              >
                {summaryLoading ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--color-primary)" }}
                    />
                    <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                      Loading balance…
                    </span>
                  </div>
                ) : entitySummary ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-label-caps mb-0.5" style={{ color: "var(--color-outline)" }}>Earned</p>
                      <p className="text-body-md font-bold" style={{ color: "var(--color-on-surface)" }}>
                        {formatCurrency(entitySummary.total_earned)}
                      </p>
                      <p className="text-label-caps" style={{ color: "var(--color-outline)" }}>From work</p>
                    </div>
                    <div>
                      <p className="text-label-caps mb-0.5" style={{ color: "var(--color-outline)" }}>Paid</p>
                      <p className="text-body-md font-bold" style={{ color: "#2d7a4f" }}>
                        {formatCurrency(entitySummary.total_paid)}
                      </p>
                      <p className="text-label-caps" style={{ color: "var(--color-outline)" }}>Given so far</p>
                    </div>
                    <div>
                      <p className="text-label-caps mb-0.5" style={{ color: "var(--color-outline)" }}>Outstanding</p>
                      <p
                        className="text-body-md font-bold"
                        style={{ color: entitySummary.pending > 0 ? "var(--color-error)" : "#2d7a4f" }}
                      >
                        {formatCurrency(Math.max(0, entitySummary.pending))}
                      </p>
                      <p className="text-label-caps" style={{ color: "var(--color-outline)" }}>Due</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-label-caps"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Amount (₹) <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-body-md font-semibold pointer-events-none"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  ₹
                </span>
                <input
                  id="payment-amount"
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.amount;
                      return next;
                    });
                  }}
                  placeholder="0"
                  className="w-full h-11 pl-8 pr-3 rounded-lg text-body-md transition-colors"
                  style={{
                    border: errors.amount
                      ? "1px solid var(--color-error)"
                      : "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
              </div>
              {errors.amount && (
                <p className="text-label-caps" style={{ color: "var(--color-error)" }}>
                  {errors.amount}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-2">
              <label
                className="text-label-caps"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className="flex items-center gap-2 h-11 px-4 rounded-xl text-body-md font-medium transition-all"
                    style={{
                      border:
                        method === m
                          ? "2px solid var(--color-primary)"
                          : "1px solid var(--color-outline-variant)",
                      backgroundColor:
                        method === m
                          ? "var(--color-primary-fixed)"
                          : "var(--color-surface-container-lowest)",
                      color:
                        method === m
                          ? "var(--color-primary)"
                          : "var(--color-on-surface-variant)",
                    }}
                  >
                    <span
                      className={`material-symbols-outlined ${method === m ? "icon-fill" : ""}`}
                      style={{ fontSize: "18px" }}
                    >
                      {METHOD_ICONS[m]}
                    </span>
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-label-caps"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Date <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 px-3 rounded-lg text-body-md transition-colors"
                style={{
                  border: errors.date
                    ? "1px solid var(--color-error)"
                    : "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-label-caps"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Notes (optional)
              </label>
              <textarea
                id="payment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Weekly advance, festival bonus…"
                rows={2}
                className="px-3 py-2.5 rounded-lg text-body-md transition-colors resize-none"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  backgroundColor: "var(--color-surface-container-lowest)",
                  color: "var(--color-on-surface)",
                  outline: "none",
                }}
              />
            </div>
          </form>

          {/* Footer */}
          <div
            className="px-6 py-5 flex gap-3 flex-shrink-0"
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
              id="payment-modal-submit"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 h-11 rounded-xl text-body-md font-semibold transition-opacity flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-on-primary)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--color-on-primary)" }}
                  />
                  Recording…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    check
                  </span>
                  Record Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
