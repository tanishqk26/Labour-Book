"use client";

import Link from "next/link";
import { useState } from "react";
import { Labour, EntityPaymentSummary } from "@/types";
import { formatCurrency, getInitials } from "@/lib/utils";
import { apiDelete, apiPost } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

interface LabourCardProps {
  labour: Labour;
  paymentSummary?: EntityPaymentSummary;
  onDeactivated?: () => void;
  onSettled?: () => void;
}

export default function LabourCard({ labour, paymentSummary, onDeactivated, onSettled }: LabourCardProps) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const timingDisplay =
    labour.work_start_time && labour.work_end_time
      ? `${parseInt(labour.work_start_time)}–${parseInt(labour.work_end_time)}`
      : "—";

  const outstanding = paymentSummary ? Math.max(0, paymentSummary.pending) : 0;
  const paymentStatus = paymentSummary?.payment_status;

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      await apiDelete(`/api/v1/labours/${labour.id}`);
      onDeactivated?.();
    } catch {
      setDeactivating(false);
      setConfirmDelete(false);
    }
  }

  async function handleSettle() {
    if (!paymentSummary || outstanding <= 0) return;
    setSettling(true);
    setSettleError(null);
    try {
      await apiPost("/api/v1/payments", {
        labour_id: labour.id,
        amount: outstanding,
        method: "cash",
        date: new Date().toISOString().slice(0, 10),
        notes: "Settlement — full balance cleared",
      });
      setConfirmSettle(false);
      onSettled?.();
    } catch {
      setSettleError(t("labours.settlementFailedMessage"));
    } finally {
      setSettling(false);
    }
  }

  return (
    <div
      className="p-5 rounded-xl card-hover relative"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      {/* Confirm deactivate overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-5 text-center"
          style={{ backgroundColor: "var(--color-error-container)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "var(--color-error)" }}>
            person_off
          </span>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-error-container)" }}>
            {t("labours.deactivateQuestion")} {labour.name}?
          </p>
          <p className="text-label-caps" style={{ color: "var(--color-on-error-container)", opacity: 0.8 }}>
            {t("labours.attendanceHistoryPreserved")}
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold"
              style={{ border: "1px solid var(--color-on-error-container)", color: "var(--color-on-error-container)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-error)", color: "var(--color-on-error)" }}
            >
              {deactivating ? t("labours.deactivating") : t("labours.deactivate")}
            </button>
          </div>
        </div>
      )}

      {/* Confirm settle overlay */}
      {confirmSettle && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-5 text-center"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "2px solid var(--color-primary)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "var(--color-primary)" }}>
            check_circle
          </span>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>
            {t("labours.settle")} {labour.name}{t("labours.settleBalanceQuestionSuffix")}
          </p>
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
            {t("labours.recordsPaymentPrefix")}{" "}
            <strong style={{ color: "var(--color-on-surface)" }}>{formatCurrency(outstanding)}</strong>{" "}
            {t("labours.clearOutstandingBalanceSuffix")}
          </p>
          {settleError && (
            <p className="text-label-caps" style={{ color: "var(--color-error)" }}>{settleError}</p>
          )}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => { setConfirmSettle(false); setSettleError(null); }}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold"
              style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSettle}
              disabled={settling}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              {settling ? t("labours.settling") : `${t("labours.settle")} ${formatCurrency(outstanding)}`}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0 avatar-hover"
          style={{ backgroundColor: "var(--color-primary-fixed)", color: "var(--color-primary)" }}
        >
          {getInitials(labour.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body-lg font-bold truncate" style={{ color: "var(--color-on-surface)" }}>
            {labour.name}
          </h3>
          <p className="text-body-md truncate" style={{ color: "var(--color-on-surface-variant)" }}>
            {labour.hometown || "—"}
          </p>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
          title={t("labours.deactivateLabourAria")}
          aria-label={t("labours.deactivateLabourAria")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>person_off</span>
        </button>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-2 gap-4 py-4"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <div>
          <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>{t("labours.dailyWage")}</p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {formatCurrency(labour.daily_wage)}{t("labours.perDay")}
          </p>
        </div>
        <div>
          <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>{t("labours.timing")}</p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {timingDisplay}
          </p>
        </div>
      </div>

      {/* Payment summary row */}
      {paymentSummary && (
        <div
          className="flex items-center justify-between py-3"
          style={{ borderTop: "1px solid var(--color-outline-variant)" }}
        >
          <div>
            <p className="text-label-caps mb-0.5" style={{ color: "var(--color-outline)" }}>{t("labours.balance")}</p>
            <p
              className="text-body-md font-bold"
              style={{ color: outstanding > 0 ? "var(--color-error)" : "#2d7a4f" }}
            >
              {outstanding > 0 ? `${formatCurrency(outstanding)} ${t("labours.due")}` : t("labours.settled")}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-label-caps px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  paymentStatus === "paid" ? "#c1ecd4"
                  : paymentStatus === "partially_paid" ? "#fef3c7"
                  : "#ffdad3",
                color:
                  paymentStatus === "paid" ? "#012d1d"
                  : paymentStatus === "partially_paid" ? "#6b4c04"
                  : "#510900",
              }}
            >
              {paymentStatus === "paid" ? t("labours.paymentStatusPaid") : paymentStatus === "partially_paid" ? t("labours.paymentStatusPartial") : t("labours.paymentStatusPending")}
            </span>
            {outstanding > 0 && (
              <button
                onClick={() => setConfirmSettle(true)}
                className="text-label-caps px-2 py-0.5 rounded-full flex items-center gap-1 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>check_circle</span>
                {t("labours.settle")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action */}
      <Link
        href={`/labours/${labour.id}`}
        className="block w-full mt-4 py-2 text-center rounded-lg text-body-md font-semibold transition-colors"
        style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-primary)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-on-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
        }}
      >
        {t("labours.viewProfile")}
      </Link>
    </div>
  );
}
