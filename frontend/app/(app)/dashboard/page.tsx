import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="p-[var(--spacing-container-margin)]">
      <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
        Dashboard
      </h1>
      <p className="text-body-lg mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
        Today&apos;s overview — coming soon
      </p>
    </div>
  );
}
