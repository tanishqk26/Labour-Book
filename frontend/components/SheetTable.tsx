"use client";

import { ReactNode } from "react";

export function SheetTable({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-x-auto rounded-xl"
      style={{
        border: "1px solid var(--color-outline-variant)",
        backgroundColor: "var(--color-surface-container-lowest)",
      }}
    >
      <table className="w-full text-left border-collapse min-w-[640px]">{children}</table>
    </div>
  );
}

export function SheetTh({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-label-caps font-semibold whitespace-nowrap ${className}`}
      style={{
        color: "var(--color-on-surface-variant)",
        borderBottom: "1px solid var(--color-outline-variant)",
        backgroundColor: "var(--color-surface-container-low)",
      }}
    >
      {children}
    </th>
  );
}

export function SheetTd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td
      className={`px-4 py-3 text-body-md align-middle ${className}`}
      style={{
        color: "var(--color-on-surface)",
        borderBottom: "1px solid var(--color-outline-variant)",
      }}
    >
      {children}
    </td>
  );
}
