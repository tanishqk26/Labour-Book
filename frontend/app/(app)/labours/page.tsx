"use client";

import { useEffect, useState, useCallback } from "react";
import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { Labour, PaginatedResponse } from "@/types";
import LabourCard from "@/components/LabourCard";
import LabourModal from "@/components/LabourModal";
import { getInitials } from "@/lib/utils";

// Note: metadata is static — dynamic metadata requires a separate server component
// The page title is set statically here
const PAGE_TITLE = "Labours | LabourBook";

export default function LaboursPage() {
  const [labours, setLabours] = useState<Labour[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

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

      const data = await apiGet<PaginatedResponse<Labour>>("/api/v1/labours", params);
      setLabours(data.items);
      setTotal(data.total);
    } catch {
      setError("Failed to load labours. Please try again.");
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
            Labour
          </h1>
          <p className="text-body-lg mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Manage individual labourers and their wage information.
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
          Add Labour
        </button>
      </header>

      {/* Content */}
      <div className="px-4 md:px-[var(--spacing-container-margin)] pb-12 flex-1 flex flex-col">
        {/* Search & Filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
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
              placeholder="Search by name or hometown..."
              className="w-full h-12 pl-12 pr-4 rounded-lg text-body-md transition-colors"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface)",
                outline: "none",
              }}
            />
          </div>
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
                Loading labours…
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
            <p className="text-body-lg font-semibold mb-2">Failed to load labours</p>
            <p className="text-body-md mb-4">{error}</p>
            <button
              onClick={fetchLabours}
              className="px-6 py-2 rounded-lg text-body-md font-semibold"
              style={{
                backgroundColor: "var(--color-on-error-container)",
                color: "var(--color-error-container)",
              }}
            >
              Try Again
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
                {debouncedSearch ? "No results found" : "No labourers yet"}
              </p>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                {debouncedSearch
                  ? `No labourers match "${debouncedSearch}"`
                  : "Add your first labourer to get started."}
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
                Add Labour
              </button>
            )}
          </div>
        )}

        {!loading && !error && labours.length > 0 && (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {labours.map((labour) => (
                <LabourCard key={labour.id} labour={labour} onDeactivated={fetchLabours} />
              ))}
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-8">
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
                    Previous
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
                    Next
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
