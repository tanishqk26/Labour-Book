import type { Metadata } from "next";

export const metadata: Metadata = { title: "Teams" };

export default function TeamsPage() {
  return (
    <div className="p-[var(--spacing-container-margin)]">
      <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
        Teams
      </h1>
      <p className="text-body-lg mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
        Labour teams — coming soon
      </p>
    </div>
  );
}
