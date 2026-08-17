/**
 * LabourBook Utility Functions
 *
 * Shared helpers: currency formatting, date formatting, class merging.
 */

// -------------------------------------------------------------------------
// Currency (Indian Rupee)
// -------------------------------------------------------------------------

/**
 * Formats a number as Indian Rupees.
 * Examples:
 *   formatCurrency(2450)   → "₹2,450"
 *   formatCurrency(100000) → "₹1,00,000"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a number with Indian number system commas (no ₹ symbol).
 * Example: formatAmount(12400) → "12,400"
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN").format(amount);
}

// -------------------------------------------------------------------------
// Dates
// -------------------------------------------------------------------------

/**
 * Formats a date as "15 Aug" (short date used in activity timelines).
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Formats a date as "15 Aug 2026" (medium date used in tables).
 */
export function formatMediumDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns a greeting based on the current hour.
 * "Good morning", "Good afternoon", "Good evening"
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// -------------------------------------------------------------------------
// Class name helper (lightweight cn() without clsx/tailwind-merge)
// -------------------------------------------------------------------------

/**
 * Merges class names, filtering out falsy values.
 * For a full solution, install clsx + tailwind-merge later.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// -------------------------------------------------------------------------
// Initials
// -------------------------------------------------------------------------

/**
 * Returns up to 2 initials from a name.
 * Example: getInitials("Shinde Team") → "ST"
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
