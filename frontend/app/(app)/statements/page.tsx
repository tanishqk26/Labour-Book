import type { Metadata } from "next";

export const metadata: Metadata = { title: "Statements" };

export default function StatementsPage() {
  return (
    <div className="p-[var(--spacing-container-margin)]">
      <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
        Statements
      </h1>
      <p className="text-body-lg mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
        Outstanding balances and earnings — coming soon
      </p>
    </div>
  );
}
