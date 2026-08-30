"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiDelete } from "@/lib/api";
import { TeamSummary, PaginatedResponse } from "@/types";
import { getInitials } from "@/lib/utils";
import TeamModal from "@/components/TeamModal";
import { formatCurrency } from "@/lib/utils";

const PAGE_TITLE = "Teams | LabourBook";
const PAGE_SIZE = 20;

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
        status: "active",
      };
      if (debouncedSearch) params.search = debouncedSearch;

      const data = await apiGet<PaginatedResponse<TeamSummary>>("/api/v1/teams", params);
      setTeams(data.items);
      setTotal(data.total);
    } catch {
      setError("Failed to load teams. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  return (
    <>
      <title>{PAGE_TITLE}</title>

      <TeamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchTeams}
      />

      {/* Page Header */}
      <header className="px-4 md:px-[var(--spacing-container-margin)] py-8 md:py-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg" style={{ color: "var(--color-primary)", fontSize: "clamp(24px, 5vw, 32px)" }}>
            Teams
          </h1>
          <p className="text-body-lg mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Manage labour groups and their members.
          </p>
        </div>
        <button
          id="add-team-btn"
          onClick={() => setModalOpen(true)}
          className="h-12 px-6 rounded-[var(--radius-DEFAULT)] text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{
            backgroundColor: "var(--color-primary-container)",
            color: "var(--color-on-primary)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
          Create Team
        </button>
      </header>

      {/* Content */}
      <div className="px-4 md:px-[var(--spacing-container-margin)] pb-12 flex-1 flex flex-col">
        {/* Search toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <span
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-on-surface-variant)", fontSize: "20px" }}
            >
              search
            </span>
            <input
              id="team-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams..."
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

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)" }}
              />
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Loading teams…
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="py-8 px-6 rounded-xl text-center"
            style={{
              backgroundColor: "var(--color-error-container)",
              color: "var(--color-on-error-container)",
            }}
          >
            <span className="material-symbols-outlined text-4xl mb-2 block">error_outline</span>
            <p className="text-body-lg font-semibold mb-2">Failed to load teams</p>
            <p className="text-body-md mb-4">{error}</p>
            <button
              onClick={fetchTeams}
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

        {/* Empty */}
        {!loading && !error && teams.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "64px", color: "var(--color-outline)" }}
            >
              group_work
            </span>
            <div className="text-center">
              <p className="text-headline-md mb-1" style={{ color: "var(--color-on-surface)" }}>
                {debouncedSearch ? "No results found" : "No teams yet"}
              </p>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                {debouncedSearch
                  ? `No teams match "${debouncedSearch}"`
                  : "Create your first team to group labourers together."}
              </p>
            </div>
            {!debouncedSearch && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-on-primary)",
                }}
              >
                Create Team
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && !error && teams.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} onUpdate={fetchTeams} />
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

// ---------------------------------------------------------------------------
// Team Card (inline)
// ---------------------------------------------------------------------------

function TeamCard({ team, onUpdate }: { team: TeamSummary; onUpdate: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      await apiDelete(`/api/v1/teams/${team.id}`);
      onUpdate();
    } catch {
      setDeactivating(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className="p-5 rounded-xl transition-shadow hover:shadow-md relative"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-5 text-center"
          style={{ backgroundColor: "var(--color-error-container)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "var(--color-error)" }}>
            group_off
          </span>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-error-container)" }}>
            Deactivate {team.name}?
          </p>
          <p className="text-label-caps" style={{ color: "var(--color-on-error-container)", opacity: 0.8 }}>
            Attendance history will be preserved.
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold"
              style={{ border: "1px solid var(--color-on-error-container)", color: "var(--color-on-error-container)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="flex-1 h-9 rounded-lg text-body-md font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-error)", color: "var(--color-on-error)" }}
            >
              {deactivating ? "Deactivating…" : "Deactivate"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0"
          style={{
            backgroundColor: "var(--color-primary-fixed)",
            color: "var(--color-primary)",
          }}
        >
          {getInitials(team.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body-lg font-bold truncate" style={{ color: "var(--color-on-surface)" }}>
            {team.name}
          </h3>
          {team.description && (
            <p className="text-body-md truncate" style={{ color: "var(--color-on-surface-variant)" }}>
              {team.description}
            </p>
          )}
        </div>
        {/* Deactivate corner button */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
          style={{
            border: "1px solid var(--color-outline-variant)",
            color: "var(--color-on-surface-variant)",
          }}
          title="Deactivate team"
          aria-label="Deactivate team"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>group_off</span>
        </button>
      </div>

      {/* Stats */}
      <div
        className="py-4 grid grid-cols-2 gap-3"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <div>
          <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>Members</p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {team.member_count} {team.member_count === 1 ? "labourer" : "labourers"}
          </p>
        </div>
        <div>
          <p className="text-label-caps mb-1" style={{ color: "var(--color-outline)" }}>Daily Rate</p>
          <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
            {formatCurrency(team.daily_wage)}/person
          </p>
        </div>
      </div>

      {/* Action */}
      <Link
        href={`/teams/${team.id}`}
        className="block w-full mt-4 py-2 text-center rounded-lg text-body-md font-semibold transition-colors"
        style={{
          border: "1px solid var(--color-primary)",
          color: "var(--color-primary)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-primary)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-on-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
        }}
      >
        View Team
      </Link>
    </div>
  );
}
