"use client";

import { useEffect, useState, useCallback } from "react";
import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { Labour, PaginatedResponse, EntityPaymentSummary } from "@/types";
import Link from "next/link";
import LabourCard from "@/components/LabourCard";
import LabourModal from "@/components/LabourModal";
import ListViewToggle from "@/components/ListViewToggle";
import { SheetTable, SheetTh, SheetTd } from "@/components/SheetTable";
import { useListView } from "@/hooks/useListView";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

// Note: metadata is static — dynamic metadata requires a separate server component
// The page title is set statically here
const PAGE_TITLE = "Labours | LabourBook";

export default function LaboursPage() {
  const { t } = useLanguage();
  const [labours, setLabours] = useState<Labour[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paymentMap, setPaymentMap] = useState<Record<string, EntityPaymentSummary>>({});
  const [listView, setListView] = useListView("lb:view:labours");

  const PAGE_SIZE = 20;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLabours = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
        status: "active",
      };
      if (debouncedSearch) params.search = debouncedSearch;

      const [data, entities] = await Promise.all([
        apiGet<PaginatedResponse<Labour>>("/api/v1/labours", params),
        apiGet<EntityPaymentSummary[]>("/api/v1/payments/entities").catch(() => [] as EntityPaymentSummary[]),
      ]);
      setLabours(data.items);
      setTotal(data.total);
      // Build a map: entity_id -> summary (only individual type)
      const map: Record<string, EntityPaymentSummary> = {};
      for (const e of entities) {
        if (e.entity_type === "individual") map[e.entity_id] = e;
      }
      setPaymentMap(map);
    } catch {
      setError(t("labours.loadFailedMessage"));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchLabours();
  }, [fetchLabours]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  return (
    <>
      <title>{PAGE_TITLE}</title>

      <LabourModal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={fetchLabours}
      />

      {/* Page Header */}
      <header
        className="px-4 md:px-[var(--spacing-container-margin)] py-8 md:py-10 flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-headline-lg" style={{ color: "var(--color-primary)" }}>
            {t("labours.pageTitle")}
          </h1>
          <p className="text-body-lg mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            {t("labours.pageSubtitle")}
          </p>
        </div>
        <button
          id="add-labour-btn"
          onClick={() => setDrawerOpen(true)}
          className="h-12 px-6 rounded-[var(--radius-DEFAULT)] text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{
            backgroundColor: "var(--color-primary-container)",
            color: "var(--color-on-primary)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
          {t("labours.addLabour")}
        </button>
      </header>

      {/* Content */}
      <div className="px-4 md:px-[var(--spacing-container-margin)] pb-12 flex-1 flex flex-col">
        {/* Search & Filter toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <span
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-on-surface-variant)", fontSize: "20px" }}
            >
              search
            </span>
            <input
              id="labour-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("labours.searchPlaceholder")}
              className="w-full h-12 pl-12 pr-4 rounded-lg text-body-md transition-colors"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface)",
                outline: "none",
              }}
            />
          </div>
          <ListViewToggle value={listView} onChange={setListView} />
        </div>

        {/* States */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }}
              />
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                {t("labours.loadingLabours")}
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div
            className="py-8 px-6 rounded-xl text-center"
            style={{
              backgroundColor: "var(--color-error-container)",
              color: "var(--color-on-error-container)",
            }}
          >
            <span className="material-symbols-outlined text-4xl mb-2 block">error_outline</span>
            <p className="text-body-lg font-semibold mb-2">{t("labours.loadFailedTitle")}</p>
            <p className="text-body-md mb-4">{error}</p>
            <button
              onClick={fetchLabours}
              className="px-6 py-2 rounded-lg text-body-md font-semibold"
              style={{
                backgroundColor: "var(--color-on-error-container)",
                color: "var(--color-error-container)",
              }}
            >
              {t("labours.tryAgain")}
            </button>
          </div>
        )}

        {!loading && !error && labours.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "64px", color: "var(--color-outline)" }}
            >
              groups
            </span>
            <div className="text-center">
              <p className="text-headline-md mb-1" style={{ color: "var(--color-on-surface)" }}>
                {debouncedSearch ? t("labours.noResultsFound") : t("labours.noLabourersYet")}
              </p>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                {debouncedSearch
                  ? `${t("labours.noResultsMatchPrefix")} "${debouncedSearch}"`
                  : t("labours.addFirstLabourer")}
              </p>
            </div>
            {!debouncedSearch && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-on-primary)",
                }}
              >
                {t("labours.addLabour")}
              </button>
            )}
          </div>
        )}

        {!loading && !error && labours.length > 0 && (
          <>
            {listView === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {labours.map((labour) => (
                <LabourCard
                  key={labour.id}
                  labour={labour}
                  paymentSummary={paymentMap[labour.id]}
                  onDeactivated={fetchLabours}
                  onSettled={fetchLabours}
                />
              ))}
            </div>
            ) : (
            <SheetTable>
              <thead>
                <tr>
                  <SheetTh>{t("common.name")}</SheetTh>
                  <SheetTh>{t("labours.hometown")}</SheetTh>
                  <SheetTh>{t("labours.dailyWage")}</SheetTh>
                  <SheetTh>{t("labours.timing")}</SheetTh>
                  <SheetTh>{t("labours.balance")}</SheetTh>
                  <SheetTh>{t("common.actions")}</SheetTh>
                </tr>
              </thead>
              <tbody>
                {labours.map((labour) => {
                  const summary = paymentMap[labour.id];
                  const outstanding = summary ? Math.max(0, summary.pending) : 0;
                  const timing =
                    labour.work_start_time && labour.work_end_time
                      ? `${parseInt(labour.work_start_time)}–${parseInt(labour.work_end_time)}`
                      : "—";
                  return (
                    <tr key={labour.id}>
                      <SheetTd className="font-semibold whitespace-nowrap">{labour.name}</SheetTd>
                      <SheetTd>{labour.hometown || "—"}</SheetTd>
                      <SheetTd className="whitespace-nowrap">{formatCurrency(labour.daily_wage)}{t("labours.perDay")}</SheetTd>
                      <SheetTd className="whitespace-nowrap">{timing}</SheetTd>
                      <SheetTd className="whitespace-nowrap">
                        {summary ? (
                          <span style={{ color: outstanding > 0 ? "var(--color-error)" : "#2d7a4f", fontWeight: 600 }}>
                            {outstanding > 0 ? `${formatCurrency(outstanding)} ${t("labours.due")}` : t("labours.settled")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </SheetTd>
                      <SheetTd>
                        <Link
                          href={`/labours/${labour.id}`}
                          className="text-body-md font-semibold whitespace-nowrap"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {t("labours.viewProfile")}
                        </Link>
                      </SheetTd>
                    </tr>
                  );
                })}
              </tbody>
            </SheetTable>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-8">
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  {t("labours.showing")} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t("labours.of")} {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-9 px-4 rounded-lg text-body-md font-medium transition-colors disabled:opacity-40"
                    style={{
                      border: "1px solid var(--color-outline-variant)",
                      color: "var(--color-on-surface-variant)",
                    }}
                  >
                    {t("labours.previous")}
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * PAGE_SIZE >= total}
                    className="h-9 px-4 rounded-lg text-body-md font-medium transition-colors disabled:opacity-40"
                    style={{
                      border: "1px solid var(--color-outline-variant)",
                      color: "var(--color-on-surface-variant)",
                    }}
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
