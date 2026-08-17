import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contracts" };

export default function ContractsPage() {
  return (
    <div className="p-[var(--spacing-container-margin)]">
      <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
        Contracts
      </h1>
      <p className="text-body-lg mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
        Fixed-price contract work — coming soon
      </p>
    </div>
  );
}
