"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { Labour } from "@/types";
import { formatCurrency, getInitials } from "@/lib/utils";
import LabourDrawer from "@/components/LabourDrawer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LabourDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [labour, setLabour] = useState<Labour | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function fetchLabour() {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await apiGet<Labour>(`/api/v1/labours/${id}`);
      setLabour(data);
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      if (apiErr?.status === 404) {
        setNotFound(true);
      } else {
        setError("Failed to load labour profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLabour();
  }, [id]);

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)" }}
          />
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  /* ---- Not found ---- */
  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "64px", color: "var(--color-outline)" }}
        >
          person_off
        </span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
          Labour not found
        </p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          The profile you are looking for does not exist.
        </p>
        <Link
          href="/labours"
          className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
        >
          Back to Labours
        </Link>
      </div>
    );
  }

  /* ---- Error ---- */
  if (error || !labour) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "64px", color: "var(--color-error)" }}
        >
          error_outline
        </span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
          Something went wrong
        </p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          {error}
        </p>
        <button
          onClick={fetchLabour}
          className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const workingTime =
    labour.work_start_time && labour.work_end_time
      ? `${labour.work_start_time} – ${labour.work_end_time}`
      : "—";

  return (
    <>
      <LabourDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={fetchLabour}
        labour={labour}
      />

      {/* Breadcrumb + Actions */}
      <header
        className="px-[var(--spacing-container-margin)] py-6 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
      >
        <Link
          href="/labours"
          className="flex items-center gap-2 text-label-caps transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            arrow_back
          </span>
          Labour Directory
        </Link>
        <div className="flex items-center gap-3">
          <button
            id="edit-labour-btn"
            onClick={() => setEditOpen(true)}
            className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-on-primary)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              edit
            </span>
            Edit Profile
          </button>
        </div>
      </header>

      <div className="px-[var(--spacing-container-margin)] py-8 flex flex-col gap-8">
        {/* Profile Card */}
        <div
          className="rounded-xl p-8 relative overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-outline-variant)",
          }}
        >
          {/* Decorative background shape */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5"
            style={{ backgroundColor: "var(--color-primary)", transform: "translate(30%, -30%)" }}
          />

          <div className="flex items-start gap-6 mb-8">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0"
              style={{
                backgroundColor: "var(--color-secondary-container)",
                color: "var(--color-on-secondary-fixed)",
              }}
            >
              {getInitials(labour.name)}
            </div>
            <div>
              <h1
                className="text-headline-lg"
                style={{ color: "var(--color-on-surface)" }}
              >
                {labour.name}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{
                    backgroundColor:
                      labour.status === "active"
                        ? "#2d7a4f"
                        : "var(--color-outline)",
                  }}
                />
                <span
                  className="text-body-md font-medium"
                  style={{
                    color:
                      labour.status === "active"
                        ? "#2d7a4f"
                        : "var(--color-on-surface-variant)",
                  }}
                >
                  {labour.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p
                className="text-label-caps mb-1 flex items-center gap-1"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  location_on
                </span>
                Hometown
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                {labour.hometown || "—"}
              </p>
            </div>
            <div>
              <p
                className="text-label-caps mb-1 flex items-center gap-1"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  payments
                </span>
                Daily Wage
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                {formatCurrency(labour.daily_wage)}/day
              </p>
            </div>
            <div>
              <p
                className="text-label-caps mb-1 flex items-center gap-1"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  schedule
                </span>
                Working Time
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                {workingTime}
              </p>
            </div>
          </div>

          {/* Contact info */}
          {(labour.phone || labour.aadhaar) && (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6"
              style={{ borderTop: "1px solid var(--color-outline-variant)" }}
            >
              {labour.phone && (
                <div>
                  <p
                    className="text-label-caps mb-1"
                    style={{ color: "var(--color-on-surface-variant)" }}
                  >
                    Phone Number
                  </p>
                  <p
                    className="text-body-md font-medium flex items-center gap-2"
                    style={{ color: "var(--color-on-surface)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      call
                    </span>
                    {labour.phone}
                  </p>
                </div>
              )}
              {labour.aadhaar && (
                <div>
                  <p
                    className="text-label-caps mb-1"
                    style={{ color: "var(--color-on-surface-variant)" }}
                  >
                    Aadhaar Number
                  </p>
                  <p
                    className="text-body-md font-medium flex items-center gap-2"
                    style={{ color: "var(--color-on-surface)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      fingerprint
                    </span>
                    {labour.aadhaar}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Financial Summary — placeholder sections for future features */}
        <section>
          <h2 className="text-headline-md mb-4" style={{ color: "var(--color-on-surface)" }}>
            Financial Summary
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Earned", value: "—", icon: "account_balance_wallet" },
              { label: "Total Borrowed", value: "—", icon: "trending_down" },
              { label: "Total Paid", value: "—", icon: "check_circle" },
              { label: "Outstanding", value: "—", icon: "warning", highlight: true },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-5"
                style={{
                  backgroundColor: stat.highlight
                    ? "var(--color-surface-container-high)"
                    : "var(--color-surface-container-lowest)",
                  border: "1px solid var(--color-outline-variant)",
                }}
              >
                <p
                  className="text-label-caps mb-3 flex items-center gap-1"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    {stat.icon}
                  </span>
                  {stat.label}
                </p>
                <p
                  className="text-display-currency"
                  style={{
                    color: stat.highlight
                      ? "var(--color-tertiary)"
                      : "var(--color-on-surface)",
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity — placeholder for future attendance/payment features */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              Recent Activity
            </h2>
            <Link
              href={`/labours/${id}/statement`}
              className="text-body-md font-medium transition-colors flex items-center gap-1"
              style={{ color: "var(--color-primary)" }}
            >
              View Full Statement
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                chevron_right
              </span>
            </Link>
          </div>
          <div
            className="rounded-xl p-8 flex flex-col items-center gap-3"
            style={{
              backgroundColor: "var(--color-surface-container-lowest)",
              border: "1px solid var(--color-outline-variant)",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "40px", color: "var(--color-outline)" }}
            >
              history
            </span>
            <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
              Attendance and payment history will appear here.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
