"use client";

import { useEffect, useRef, useState } from "react";

interface TimePickerProps {
  id?: string;
  value: string; // "HH:MM" 24-hour
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

function parseValue(value: string): { hour24: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { hour24: Number(match[1]), minute: Number(match[2]) };
}

function to24(hour12: number, minute: number, isPM: boolean): string {
  let hour24 = hour12 % 12;
  if (isPM) hour24 += 12;
  return `${hour24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function formatDisplay(value: string): string {
  const parsed = parseValue(value);
  if (!parsed) return "";
  const isPM = parsed.hour24 >= 12;
  const hour12 = parsed.hour24 % 12 === 0 ? 12 : parsed.hour24 % 12;
  return `${hour12.toString().padStart(2, "0")}:${parsed.minute.toString().padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
}

/**
 * Themed time picker that replaces the native <input type="time">
 * so the popup panel matches the app's design system, with no
 * scroll-wheel value changes or native spinner arrows.
 */
export default function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Select time",
  hasError = false,
  disabled = false,
  className = "",
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const isPM = parsed ? parsed.hour24 >= 12 : false;
  const hour12 = parsed ? (parsed.hour24 % 12 === 0 ? 12 : parsed.hour24 % 12) : 12;
  const minute = parsed ? parsed.minute : 0;

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

  function set(hour12Next: number, minuteNext: number, isPMNext: boolean) {
    onChange(to24(hour12Next, minuteNext, isPMNext));
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
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
          schedule
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1.5 rounded-xl overflow-hidden z-50 flex"
          style={{
            backgroundColor: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-outline-variant)",
            boxShadow: "0 8px 28px rgba(1, 45, 29, 0.16), 0 2px 8px rgba(1, 45, 29, 0.08)",
            width: "220px",
          }}
        >
          {/* Hours */}
          <div className="flex-1 overflow-y-auto py-1" style={{ maxHeight: "220px", borderRight: "1px solid var(--color-outline-variant)" }}>
            {HOURS_12.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => set(h, minute, isPM)}
                className="w-full text-center py-2 text-body-md transition-colors"
                style={{
                  backgroundColor: h === hour12 ? "var(--color-primary-fixed)" : "transparent",
                  color: h === hour12 ? "var(--color-primary)" : "var(--color-on-surface)",
                  fontWeight: h === hour12 ? 700 : 400,
                }}
              >
                {h.toString().padStart(2, "0")}
              </button>
            ))}
          </div>

          {/* Minutes */}
          <div className="flex-1 overflow-y-auto py-1" style={{ maxHeight: "220px", borderRight: "1px solid var(--color-outline-variant)" }}>
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set(hour12, m, isPM)}
                className="w-full text-center py-2 text-body-md transition-colors"
                style={{
                  backgroundColor: m === minute ? "var(--color-primary-fixed)" : "transparent",
                  color: m === minute ? "var(--color-primary)" : "var(--color-on-surface)",
                  fontWeight: m === minute ? 700 : 400,
                }}
              >
                {m.toString().padStart(2, "0")}
              </button>
            ))}
          </div>

          {/* AM / PM */}
          <div className="flex-shrink-0 flex flex-col py-1" style={{ width: "56px" }}>
            {(["AM", "PM"] as const).map((label) => {
              const active = (label === "PM") === isPM;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set(hour12, minute, label === "PM")}
                  className="text-center py-2 text-body-md transition-colors"
                  style={{
                    backgroundColor: active ? "var(--color-primary)" : "transparent",
                    color: active ? "var(--color-on-primary)" : "var(--color-on-surface)",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
