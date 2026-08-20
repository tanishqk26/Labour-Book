"use client";

import Link from "next/link";
import { Labour } from "@/types";
import { formatCurrency, getInitials } from "@/lib/utils";

interface LabourCardProps {
  labour: Labour;
}

export default function LabourCard({ labour }: LabourCardProps) {
  const timing =
    labour.work_start_time && labour.work_end_time
      ? `${labour.work_start_time.slice(0, 5).replace(":", "h")}–${labour.work_end_time.slice(0, 5).replace(":", "h")}`
      : "—";

  const timingDisplay =
    labour.work_start_time && labour.work_end_time
      ? `${parseInt(labour.work_start_time)}–${parseInt(labour.work_end_time)}`
      : "—";

  return (
    <div
      className="p-6 rounded-xl transition-shadow hover:shadow-md cursor-pointer"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0"
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
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-label-caps flex-shrink-0"
          style={{
            backgroundColor:
              labour.status === "active"
                ? "var(--color-primary-fixed)"
                : "var(--color-surface-variant)",
            color:
              labour.status === "active"
                ? "var(--color-on-primary-fixed-variant)"
                : "var(--color-on-surface-variant)",
          }}
        >
          {labour.status === "active" ? "Active" : "Inactive"}
        </span>
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
