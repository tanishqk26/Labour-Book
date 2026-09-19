"use client";

import { useEffect, useRef, useState } from "react";

interface DatePickerProps {
  id?: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toISO(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, "0")}-${(m + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function parseISO(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function formatDisplay(value: string): string {
  const parsed = parseISO(value);
  if (!parsed) return "";
  const date = new Date(parsed.y, parsed.m, parsed.d);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Themed calendar picker that replaces the native <input type="date">
 * so the popup panel matches the app's design system.
 */
export default function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select date",
  hasError = false,
  min,
  max,
  disabled = false,
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [popupSide, setPopupSide] = useState<"left" | "right">("left");
  const parsed = parseISO(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseISO(value);
    setViewYear(p?.y ?? today.getFullYear());
    setViewMonth(p?.m ?? today.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const minParsed = min ? parseISO(min) : null;
  const maxParsed = max ? parseISO(max) : null;
  const minISO = minParsed ? toISO(minParsed.y, minParsed.m, minParsed.d) : null;
  const maxISO = maxParsed ? toISO(maxParsed.y, maxParsed.m, maxParsed.d) : null;

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function selectDay(day: number) {
    const iso = toISO(viewYear, viewMonth, day);
    if (minISO && iso < minISO) return;
    if (maxISO && iso > maxISO) return;
    onChange(iso);
    setOpen(false);
  }

  function selectToday() {
    onChange(toISO(today.getFullYear(), today.getMonth(), today.getDate()));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open && rootRef.current) {
            const rect = rootRef.current.getBoundingClientRect();
            // Flip to right-aligned if there isn't 300px of space to the right
            setPopupSide(window.innerWidth - rect.left < 316 ? "right" : "left");
          }
          setOpen((v) => !v);
        }}
        className="w-full h-11 px-3 rounded-lg text-body-md transition-colors flex items-center justify-between gap-2 text-left"
        style={{
          border: hasError ? "1px solid var(--color-error)" : "1px solid var(--color-outline-variant)",
          backgroundColor: "var(--color-surface-container-lowest)",
          color: value ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: "18px", color: "var(--color-on-surface-variant)" }}>
          calendar_month
        </span>
      </button>

      {open && (
        <div
          className={`absolute ${popupSide === "left" ? "left-0" : "right-0"} mt-1.5 rounded-xl overflow-hidden z-50`}
          style={{
            backgroundColor: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-outline-variant)",
            boxShadow: "0 8px 28px rgba(1, 45, 29, 0.16), 0 2px 8px rgba(1, 45, 29, 0.08)",
            width: "300px",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
          >
            <button type="button" onClick={() => goMonth(-1)} className="w-7 h-7 rounded-md flex items-center justify-center hover-grow" aria-label="Previous month">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_left</span>
            </button>
            <span className="text-body-md font-semibold">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={() => goMonth(1)} className="w-7 h-7 rounded-md flex items-center justify-center hover-grow" aria-label="Next month">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 px-2 pt-2.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-label-caps text-center py-1" style={{ color: "var(--color-on-surface-variant)" }}>
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-2">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const iso = toISO(viewYear, viewMonth, day);
              const isSelected = iso === value;
              const isToday = iso === toISO(today.getFullYear(), today.getMonth(), today.getDate());
              const isDisabled = (minISO !== null && iso < minISO) || (maxISO !== null && iso > maxISO);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDay(day)}
                  className="h-8 w-8 mx-auto rounded-full text-body-md flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: isSelected ? "var(--color-primary)" : "transparent",
                    color: isDisabled
                      ? "var(--color-outline-variant)"
                      : isSelected
                      ? "var(--color-on-primary)"
                      : "var(--color-on-surface)",
                    fontWeight: isToday && !isSelected ? 700 : 400,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDisabled) e.currentTarget.style.backgroundColor = "var(--color-surface-container-low)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderTop: "1px solid var(--color-outline-variant)" }}
          >
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-label-caps px-2 py-1"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="text-label-caps px-2 py-1"
              style={{ color: "var(--color-primary)" }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
