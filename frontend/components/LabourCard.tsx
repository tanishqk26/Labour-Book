"use client";

import Link from "next/link";
import { useState } from "react";
import { Labour } from "@/types";
import { formatCurrency, getInitials } from "@/lib/utils";
import { apiDelete } from "@/lib/api";

interface LabourCardProps {
  labour: Labour;
  onDeactivated?: () => void;
}

export default function LabourCard({ labour, onDeactivated }: LabourCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const timingDisplay =
    labour.work_start_time && labour.work_end_time
      ? `${parseInt(labour.work_start_time)}–${parseInt(labour.work_end_time)}`
      : "—";

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

  return (
    <div
      className="p-5 rounded-xl card-hover relative"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-5 text-center"
          style={{
            backgroundColor: "var(--color-error-container)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "var(--color-error)" }}>
            person_off
          </span>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-error-container)" }}>
            Deactivate {labour.name}?
          </p>
          <p className="text-label-caps" style={{ color: "var(--color-on-error-container)", opacity: 0.8 }}>
            Attendance history will be preserved.
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold"
              style={{ border: "1px solid var(--color-on-error-container)", color: "var(--color-on-error-container)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-error)", color: "var(--color-on-error)" }}
            >
              {deactivating ? "Deactivating…" : "Deactivate"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0 avatar-hover"
          style={{
            backgroundColor: "var(--color-primary-fixed)",
            color: "var(--color-primary)",
          }}
        >
          {getInitials(labour.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-body-lg font-bold truncate"
            style={{ color: "var(--color-on-surface)" }}
          >
            {labour.name}
          </h3>
          <p
            className="text-body-md truncate"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            {labour.hometown || "—"}
          </p>
        </div>
        {/* Deactivate button in corner */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
          style={{
            border: "1px solid var(--color-outline-variant)",
            color: "var(--color-on-surface-variant)",
          }}
          title="Deactivate labour"
          aria-label="Deactivate labour"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            person_off
          </span>
        </button>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-2 gap-4 py-4"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <div>
          <p
            className="text-label-caps mb-1"
            style={{ color: "var(--color-outline)" }}
          >
            Daily Wage
          </p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {formatCurrency(labour.daily_wage)}/day
          </p>
        </div>
        <div>
          <p
            className="text-label-caps mb-1"
            style={{ color: "var(--color-outline)" }}
          >
            Timing
          </p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {timingDisplay}
          </p>
        </div>
      </div>

      {/* Action */}
      <Link
        href={`/labours/${labour.id}`}
        className="block w-full mt-4 py-2 text-center rounded-lg text-body-md font-semibold transition-colors"
        style={{
          border: "1px solid var(--color-primary)",
          color: "var(--color-primary)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-primary)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-on-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
        }}
      >
        View Profile
      </Link>
    </div>
  );
}
