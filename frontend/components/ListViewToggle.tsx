"use client";

import { ListView } from "@/hooks/useListView";
import { useLanguage } from "@/context/LanguageContext";

interface ListViewToggleProps {
  value: ListView;
  onChange: (view: ListView) => void;
}

export default function ListViewToggle({ value, onChange }: ListViewToggleProps) {
  const { t } = useLanguage();

  return (
    <div
      className="inline-flex h-12 p-1 rounded-lg flex-shrink-0"
      role="group"
      aria-label={t("common.view")}
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
        title={t("common.cardView")}
        className="w-10 h-10 rounded-md flex items-center justify-center transition-colors"
        style={{
          backgroundColor: value === "cards" ? "var(--color-primary-fixed)" : "transparent",
          color: value === "cards" ? "var(--color-primary)" : "var(--color-on-surface-variant)",
        }}
      >
        <span className={`material-symbols-outlined ${value === "cards" ? "icon-fill" : ""}`} style={{ fontSize: "20px" }}>
          grid_view
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("sheet")}
        aria-pressed={value === "sheet"}
        title={t("common.sheetView")}
        className="w-10 h-10 rounded-md flex items-center justify-center transition-colors"
        style={{
          backgroundColor: value === "sheet" ? "var(--color-primary-fixed)" : "transparent",
          color: value === "sheet" ? "var(--color-primary)" : "var(--color-on-surface-variant)",
        }}
      >
        <span className={`material-symbols-outlined ${value === "sheet" ? "icon-fill" : ""}`} style={{ fontSize: "20px" }}>
          table_rows
        </span>
      </button>
    </div>
  );
}
