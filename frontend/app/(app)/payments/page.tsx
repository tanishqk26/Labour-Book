import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <div className="p-[var(--spacing-container-margin)]">
      <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
        Payments
      </h1>
      <p className="text-body-lg mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
        Advances and payments recorded — coming soon
      </p>
    </div>
  );
}
