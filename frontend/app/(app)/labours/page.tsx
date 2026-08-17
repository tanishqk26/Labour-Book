import type { Metadata } from "next";

export const metadata: Metadata = { title: "Labours" };

export default function LaboursPage() {
  return (
    <div className="p-[var(--spacing-container-margin)]">
      <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
        Labours
      </h1>
      <p className="text-body-lg mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
        Individual labour directory — coming soon
      </p>
    </div>
  );
}
