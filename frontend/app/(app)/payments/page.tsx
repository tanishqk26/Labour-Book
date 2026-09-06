"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { PaymentRead, PaginatedPayments } from "@/types";
import { formatCurrency, formatMediumDate, getInitials } from "@/lib/utils";
import PaymentModal from "@/components/PaymentModal";

const PAGE_TITLE = "Payments | LabourBook";

const METHOD_ICONS: Record<string, string> = {
  cash: "payments",
  upi: "qr_code_scanner",
  bank_transfer: "account_balance",
  other: "receipt",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const AVATAR_COLORS = [
  { bg: "#c1ecd4", color: "#012d1d" },
  { bg: "#d7e4f0", color: "#111d25" },
  { bg: "#fef3c7", color: "#6b4c04" },
  { bg: "#ffdad3", color: "#510900" },
  { bg: "#e8d5f7", color: "#3d1457" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  const [todayPayments, setTodayPayments] = useState<PaymentRead[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const today = todayISO();

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayData, recentData] = await Promise.all([
        apiGet<PaginatedPayments>("/api/v1/payments", {
          date_from: today,
          date_to: today,
          page_size: 50,
        }),
        apiGet<PaginatedPayments>("/api/v1/payments", { page_size: 15 }),
      ]);
      setTodayPayments(todayData.items);
      setRecentPayments(recentData.items);
    } catch {
      setError("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0);
  const dateLabel = new Date()
    .toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <>
      <title>{PAGE_TITLE}</title>

      <PaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchPayments}
      />

      {/* Page Header */}
      <header className="px-4 md:px-[var(--spacing-container-margin)] py-8 md:py-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1
            className="text-headline-lg"
            style={{ color: "var(--color-primary)", fontSize: "clamp(24px, 5vw, 32px)" }}
          >
            Payments
          </h1>
          <p className="text-body-lg mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Record and track payments to labours and teams.
          </p>
        </div>
        <button
          id="note-payment-btn"
          onClick={() => setModalOpen(true)}
          className="h-12 px-6 rounded-[var(--radius-DEFAULT)] text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{
            backgroundColor: "var(--color-primary-container)",
            color: "var(--color-on-primary)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
          Note Payment
        </button>
      </header>

      <div className="px-4 md:px-[var(--spacing-container-margin)] pb-12 flex flex-col gap-8">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }}
              />
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Loading payments…
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="py-8 px-6 rounded-xl text-center"
            style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}
          >
            <span className="material-symbols-outlined text-4xl mb-2 block">error_outline</span>
            <p className="text-body-lg font-semibold mb-2">Failed to load payments</p>
            <p className="text-body-md mb-4">{error}</p>
            <button
              onClick={fetchPayments}
              className="px-6 py-2 rounded-lg text-body-md font-semibold"
              style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Today's summary card */}
            <div
              className="rounded-2xl px-6 py-5 flex items-center gap-4"
              style={{
                backgroundColor: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                <span className="material-symbols-outlined icon-fill" style={{ color: "#fff", fontSize: "20px" }}>
                  calendar_today
                </span>
              </div>
              <div className="flex-1">
                <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                  {dateLabel}
                </p>
                <p className="text-body-md font-semibold mt-0.5" style={{ color: "var(--color-on-surface)" }}>
                  {todayPayments.length === 0
                    ? "No payments recorded today"
                    : `${todayPayments.length} payment${todayPayments.length > 1 ? "s" : ""} recorded today · ${formatCurrency(todayTotal)} total`}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="h-10 px-5 rounded-xl text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
                Note Payment
              </button>
            </div>

            {/* Today's payments */}
            {todayPayments.length > 0 && (
              <div>
                <h2 className="text-body-lg font-semibold mb-4" style={{ color: "var(--color-on-surface)" }}>
                  Today&apos;s Payments
                </h2>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                  }}
                >
                  {todayPayments.map((p, idx) => {
                    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-4 px-5 py-4"
                        style={{
                          borderBottom: idx < todayPayments.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-label-caps font-bold flex-shrink-0"
                          style={{ backgroundColor: color.bg, color: color.color }}
                        >
                          {getInitials(p.entity_name ?? "?")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                            {p.entity_name ?? "Unknown"}
                          </p>
                          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                            {METHOD_LABELS[p.method] ?? p.method}
                            {p.entity_type === "team" && " · Team"}
                            {p.notes && ` · ${p.notes}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-body-md font-bold" style={{ color: "#2d7a4f" }}>
                            {formatCurrency(p.amount)}
                          </p>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px", color: "var(--color-outline)" }}
                            >
                              {METHOD_ICONS[p.method] ?? "receipt"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Total row */}
                  <div
                    className="flex justify-between items-center px-5 py-3"
                    style={{
                      borderTop: "2px solid var(--color-outline-variant)",
                      backgroundColor: "var(--color-surface-container-low)",
                    }}
                  >
                    <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface-variant)" }}>
                      Today&apos;s Total
                    </p>
                    <p className="text-body-md font-bold" style={{ color: "var(--color-on-surface)" }}>
                      {formatCurrency(todayTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Payments */}
            <div>
              <h2 className="text-body-lg font-semibold mb-4" style={{ color: "var(--color-on-surface)" }}>
                Recent Payments
              </h2>

              {recentPayments.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl"
                  style={{
                    border: "1.5px dashed var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "48px", color: "var(--color-outline)" }}
                  >
                    receipt_long
                  </span>
                  <div className="text-center">
                    <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
                      No payments recorded yet
                    </p>
                    <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                      Use &ldquo;Note Payment&rdquo; to record a payment. Full history is available on each labour or team profile.
                    </p>
                  </div>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="h-10 px-6 rounded-xl text-body-md font-semibold"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                  >
                    Note First Payment
                  </button>
                </div>
              ) : (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: "1px solid var(--color-outline-variant)",
                    backgroundColor: "var(--color-surface-container-lowest)",
                  }}
                >
                  {/* Header row */}
                  <div
                    className="grid px-5 py-3"
                    style={{
                      gridTemplateColumns: "1fr 110px 110px 100px",
                      borderBottom: "1px solid var(--color-outline-variant)",
                      backgroundColor: "var(--color-surface-container-low)",
                      minWidth: "460px",
                    }}
                  >
                    {["Name", "Date", "Method", "Amount"].map((h) => (
                      <p key={h} className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
                        {h}
                      </p>
                    ))}
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    {recentPayments.map((p, idx) => {
                      const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      return (
                        <div
                          key={p.id}
                          className="grid items-center px-5 py-4"
                          style={{
                            gridTemplateColumns: "1fr 110px 110px 100px",
                            borderBottom: idx < recentPayments.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                            minWidth: "460px",
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-label-caps font-bold flex-shrink-0"
                              style={{ backgroundColor: color.bg, color: color.color }}
                            >
                              {getInitials(p.entity_name ?? "?")}
                            </div>
                            <div className="min-w-0">
                              <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                                {p.entity_name ?? "Unknown"}
                              </p>
                              <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>
                                {p.entity_type === "team" ? "Team" : "Labour"}
                              </span>
                            </div>
                          </div>
                          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                            {formatMediumDate(p.date)}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}
                            >
                              {METHOD_ICONS[p.method] ?? "receipt"}
                            </span>
                            <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                              {METHOD_LABELS[p.method] ?? p.method}
                            </p>
                          </div>
                          <p className="text-body-md font-semibold" style={{ color: "#2d7a4f" }}>
                            {formatCurrency(p.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-body-md mt-4" style={{ color: "var(--color-on-surface-variant)" }}>
                💡 Full payment history for each person is available in their{" "}
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>labour</span> or{" "}
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>team profile</span>.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
