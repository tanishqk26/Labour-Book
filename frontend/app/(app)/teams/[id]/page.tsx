"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch, apiGet, apiPost, ApiError } from "@/lib/api";
import { Team, Labour, PaginatedResponse } from "@/types";
import { formatCurrency, getInitials } from "@/lib/utils";
import TeamModal from "@/components/TeamModal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TeamDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Member management state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableLabours, setAvailableLabours] = useState<Labour[]>([]);
  const [labourSearch, setLabourSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function fetchTeam() {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await apiGet<Team>(`/api/v1/teams/${id}`);
      setTeam(data);
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      if (apiErr?.status === 404) {
        setNotFound(true);
      } else {
        setError("Failed to load team.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, [id]);

  // Fetch available labours (all active, excluding current members)
  const fetchAvailableLabours = useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<Labour>>("/api/v1/labours", {
        status: "active",
        page_size: 100,
        ...(labourSearch ? { search: labourSearch } : {}),
      });
      const memberIds = new Set(team?.members.map((m) => m.id) ?? []);
      setAvailableLabours(data.items.filter((l) => !memberIds.has(l.id)));
    } catch {
      // silently ignore — user can retry by closing/reopening
    }
  }, [team, labourSearch]);

  useEffect(() => {
    if (addMemberOpen) {
      fetchAvailableLabours();
      setSelectedIds(new Set());
      setAddError(null);
    }
  }, [addMemberOpen, fetchAvailableLabours]);

  // Debounce labour search inside the add-member panel
  useEffect(() => {
    if (!addMemberOpen) return;
    const t = setTimeout(() => fetchAvailableLabours(), 350);
    return () => clearTimeout(t);
  }, [labourSearch, addMemberOpen, fetchAvailableLabours]);

  async function handleAddMembers() {
    if (selectedIds.size === 0) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await apiPost(`/api/v1/teams/${id}/members`, {
        labour_ids: Array.from(selectedIds),
      });
      await fetchTeam();
      setAddMemberOpen(false);
      setSelectedIds(new Set());
      setLabourSearch("");
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { detail?: string } | null;
        setAddError(typeof data?.detail === "string" ? data.detail : "Failed to add members.");
      } else {
        setAddError("Network error. Please try again.");
      }
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemoveMember(labourId: string) {
    setRemovingId(labourId);
    try {
      await apiFetch(`/api/v1/teams/${id}/members`, {
        method: "DELETE",
        body: JSON.stringify({ labour_ids: [labourId] }),
      });
      await fetchTeam();
    } catch {
      // ignore — team will reload on next interaction
    } finally {
      setRemovingId(null);
    }
  }

  function toggleSelect(labourId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(labourId)) next.delete(labourId);
      else next.add(labourId);
      return next;
    });
  }

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)" }}
          />
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
            Loading team…
          </p>
        </div>
      </div>
    );
  }

  /* ---- Not found ---- */
  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "64px", color: "var(--color-outline)" }}
        >
          group_off
        </span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
          Team not found
        </p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          The team you are looking for does not exist.
        </p>
        <Link
          href="/teams"
          className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
        >
          Back to Teams
        </Link>
      </div>
    );
  }

  /* ---- Error ---- */
  if (error || !team) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "64px", color: "var(--color-error)" }}
        >
          error_outline
        </span>
        <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
          Something went wrong
        </p>
        <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
          {error}
        </p>
        <button
          onClick={fetchTeam}
          className="mt-2 h-11 px-6 rounded-lg text-body-md font-semibold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <TeamModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={fetchTeam}
        team={team}
      />

      {/* Breadcrumb + Actions */}
      <header
        className="px-[var(--spacing-container-margin)] py-6 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
      >
        <Link
          href="/teams"
          className="flex items-center gap-2 text-label-caps transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            arrow_back
          </span>
          Teams
        </Link>
        <button
          id="edit-team-btn"
          onClick={() => setEditOpen(true)}
          className="h-10 px-5 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            edit
          </span>
          Edit Team
        </button>
      </header>

      <div className="px-[var(--spacing-container-margin)] py-8 flex flex-col gap-8">
        {/* Team Card */}
        <div
          className="rounded-xl p-8 relative overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-outline-variant)",
          }}
        >
          {/* Decorative background shape */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5"
            style={{ backgroundColor: "var(--color-primary)", transform: "translate(30%, -30%)" }}
          />

          <div className="flex items-start gap-6 mb-6">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-headline-md font-bold flex-shrink-0"
              style={{
                backgroundColor: "var(--color-secondary-container)",
                color: "var(--color-on-secondary-fixed)",
              }}
            >
              {getInitials(team.name)}
            </div>
            <div>
              <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)" }}>
                {team.name}
              </h1>
              {team.description && (
                <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                  {team.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{
                    backgroundColor: team.status === "active" ? "#2d7a4f" : "var(--color-outline)",
                  }}
                />
                <span
                  className="text-body-md font-medium"
                  style={{
                    color: team.status === "active" ? "#2d7a4f" : "var(--color-on-surface-variant)",
                  }}
                >
                  {team.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6"
            style={{ borderTop: "1px solid var(--color-outline-variant)" }}
          >
            <div>
              <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Total Members
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                {team.member_count} {team.member_count === 1 ? "labourer" : "labourers"}
              </p>
            </div>
            <div>
              <p className="text-label-caps mb-1" style={{ color: "var(--color-on-surface-variant)" }}>
                Created
              </p>
              <p className="text-body-md font-medium" style={{ color: "var(--color-on-surface)" }}>
                {new Date(team.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              Members
            </h2>
            <button
              id="add-member-btn"
              onClick={() => setAddMemberOpen(true)}
              className="h-9 px-4 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--color-primary-fixed)",
                color: "var(--color-primary)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                person_add
              </span>
              Add Members
            </button>
          </div>

          {team.members.length === 0 ? (
            <div
              className="rounded-xl p-10 flex flex-col items-center gap-3"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "48px", color: "var(--color-outline)" }}
              >
                group_add
              </span>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                No members yet. Add existing labourers to this team.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {team.members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  removing={removingId === member.id}
                  onRemove={() => handleRemoveMember(member.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add Members Panel */}
      {addMemberOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setAddMemberOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-in drawer */}
          <div
            className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl"
            style={{
              width: "min(440px, 100vw)",
              backgroundColor: "var(--color-surface)",
              borderLeft: "1px solid var(--color-outline-variant)",
            }}
            role="dialog"
            aria-label="Add members"
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
            >
              <h3 className="text-headline-md" style={{ color: "var(--color-primary)" }}>
                Add Members
              </h3>
              <button
                onClick={() => setAddMemberOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70"
                style={{ color: "var(--color-on-surface-variant)" }}
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Search */}
            <div
              className="px-6 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
            >
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-on-surface-variant)", fontSize: "18px" }}
                >
                  search
                </span>
                <input
                  id="member-search"
                  type="text"
                  value={labourSearch}
                  onChange={(e) => setLabourSearch(e.target.value)}
                  placeholder="Search labourers..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg text-body-md"
                  style={{
                    backgroundColor: "var(--color-surface-container-lowest)",
                    border: "1px solid var(--color-outline-variant)",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
              </div>
              {selectedIds.size > 0 && (
                <p className="mt-2 text-label-caps" style={{ color: "var(--color-primary)" }}>
                  {selectedIds.size} selected
                </p>
              )}
            </div>

            {/* Labour list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {addError && (
                <div
                  className="mb-4 px-4 py-3 rounded-lg text-body-md"
                  style={{
                    backgroundColor: "var(--color-error-container)",
                    color: "var(--color-on-error-container)",
                  }}
                >
                  {addError}
                </div>
              )}

              {availableLabours.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "40px", color: "var(--color-outline)" }}
                  >
                    person_search
                  </span>
                  <p className="text-body-md text-center" style={{ color: "var(--color-on-surface-variant)" }}>
                    {labourSearch
                      ? "No labourers match your search."
                      : "All active labourers are already in this team."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {availableLabours.map((labour) => {
                    const checked = selectedIds.has(labour.id);
                    return (
                      <button
                        key={labour.id}
                        type="button"
                        onClick={() => toggleSelect(labour.id)}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors"
                        style={{
                          backgroundColor: checked
                            ? "var(--color-primary-fixed)"
                            : "var(--color-surface-container-lowest)",
                          border: `1px solid ${checked ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-body-md font-bold flex-shrink-0"
                          style={{
                            backgroundColor: checked
                              ? "var(--color-primary)"
                              : "var(--color-secondary-container)",
                            color: checked
                              ? "var(--color-on-primary)"
                              : "var(--color-on-secondary-fixed)",
                          }}
                        >
                          {checked ? (
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                              check
                            </span>
                          ) : (
                            getInitials(labour.name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-body-md font-semibold truncate"
                            style={{ color: "var(--color-on-surface)" }}
                          >
                            {labour.name}
                          </p>
                          <p
                            className="text-label-caps truncate"
                            style={{ color: "var(--color-on-surface-variant)" }}
                          >
                            {formatCurrency(labour.daily_wage)}/day
                            {labour.hometown ? ` · ${labour.hometown}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex justify-end gap-3 px-6 py-5 flex-shrink-0"
              style={{ borderTop: "1px solid var(--color-outline-variant)" }}
            >
              <button
                type="button"
                onClick={() => setAddMemberOpen(false)}
                className="h-10 px-5 rounded-lg text-body-md font-semibold hover:opacity-80"
                style={{
                  border: "1px solid var(--color-outline-variant)",
                  color: "var(--color-on-surface-variant)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMembers}
                disabled={selectedIds.size === 0 || addLoading}
                className="h-10 px-6 rounded-lg text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-on-primary)",
                }}
              >
                {addLoading ? (
                  <>
                    <span
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--color-on-primary)" }}
                    />
                    Adding…
                  </>
                ) : (
                  `Add ${selectedIds.size > 0 ? selectedIds.size : ""} ${selectedIds.size === 1 ? "Member" : "Members"}`
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Member Card
// ---------------------------------------------------------------------------

function MemberCard({
  member,
  removing,
  onRemove,
}: {
  member: Labour;
  removing: boolean;
  onRemove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div
      className="p-4 rounded-xl flex items-center gap-4"
      style={{
        backgroundColor: "var(--color-surface-container-lowest)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-body-md font-bold flex-shrink-0"
        style={{
          backgroundColor: "var(--color-primary-fixed)",
          color: "var(--color-primary)",
        }}
      >
        {getInitials(member.name)}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/labours/${member.id}`}
          className="text-body-md font-semibold truncate block hover:underline"
          style={{ color: "var(--color-on-surface)" }}
        >
          {member.name}
        </Link>
        <p className="text-label-caps truncate" style={{ color: "var(--color-on-surface-variant)" }}>
          {formatCurrency(member.daily_wage)}/day
          {member.hometown ? ` · ${member.hometown}` : ""}
        </p>
      </div>

      {confirmRemove ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmRemove(false)}
            className="text-label-caps px-2 py-1 rounded"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmRemove(false);
              onRemove();
            }}
            disabled={removing}
            className="text-label-caps px-2 py-1 rounded font-semibold"
            style={{ color: "var(--color-error)" }}
          >
            {removing ? "…" : "Remove"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-70"
          style={{ color: "var(--color-outline)" }}
          aria-label={`Remove ${member.name}`}
          title="Remove from team"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            person_remove
          </span>
        </button>
      )}
    </div>
  );
}
