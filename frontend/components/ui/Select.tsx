"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  /** When provided, renders a "+ Add new…" action at the bottom of the dropdown */
  onAddNew?: () => void;
  /** Label for the add-new action row. Defaults to "Add new…" */
  addNewLabel?: string;
}

/**
 * Themed dropdown that replaces the native <select> so the open list
 * matches the app's design system instead of default OS chrome.
 */
export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  hasError = false,
  className = "",
  onAddNew,
  addNewLabel = "Add new…",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const selected = options.find((o) => o.value === value);

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
          color: selected ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span
          className="material-symbols-outlined flex-shrink-0"
          style={{ fontSize: "18px", color: "var(--color-on-surface-variant)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 rounded-lg overflow-y-auto z-50"
          style={{
            backgroundColor: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-outline-variant)",
            boxShadow: "0 8px 28px rgba(1, 45, 29, 0.16), 0 2px 8px rgba(1, 45, 29, 0.08)",
            maxHeight: "240px",
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
              No options
            </div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="px-3 py-2.5 text-body-md transition-colors"
                style={{
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  opacity: opt.disabled ? 0.5 : 1,
                  backgroundColor: opt.value === value ? "var(--color-primary-fixed)" : "transparent",
                  color: opt.value === value ? "var(--color-primary)" : "var(--color-on-surface)",
                  fontWeight: opt.value === value ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) e.currentTarget.style.backgroundColor = "var(--color-surface-container-low)";
                }}
                onMouseLeave={(e) => {
                  if (opt.value !== value) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {opt.label}
              </div>
            ))
          )}
          {/* Add-new action */}
          {onAddNew && (
            <div
              role="option"
              aria-selected={false}
              onClick={() => { onAddNew(); setOpen(false); }}
              className="px-3 py-2.5 text-body-md flex items-center gap-2 transition-colors"
              style={{
                cursor: "pointer",
                color: "var(--color-primary)",
                fontWeight: 600,
                borderTop: options.length > 0 ? "1px dashed var(--color-outline-variant)" : "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-primary-fixed)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add_circle</span>
              {addNewLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
