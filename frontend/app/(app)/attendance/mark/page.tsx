"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import LabourModal from "@/components/LabourModal";
import TeamModal from "@/components/TeamModal";
import Select from "@/components/ui/Select";
import WeeklyAttendanceSheet, {
  AttStatus,
  SheetAtt,
  SheetEntity,
  SheetPayment,
  addDays,
  formatWeekRange,
  mondayOf,
  toISODate,
} from "@/components/WeeklyAttendanceSheet";

interface LabourItem { id: string; name: string; }
interface TeamItem { id: string; name: string; member_count?: number; }
interface Paginated<T> { items: T[]; }

const CYCLE: (AttStatus | null)[] = [null, "present", "half_day", "absent"];

function rosterKey(weekStart: string) {
  return `lb:att-sheet:${weekStart}`;
}

function readRoster(weekStart: string): string[] {
  try {
    const raw = localStorage.getItem(rosterKey(weekStart));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRoster(weekStart: string, keys: string[]) {
  try {
    localStorage.setItem(rosterKey(weekStart), JSON.stringify(keys));
  } catch { /* ignore */ }
}

export default function MarkAttendancePage() {
  const { t } = useLanguage();
  const today = toISODate(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [entityFilter, setEntityFilter] = useState<"all" | "labour" | "team">("all");
  const [labours, setLabours] = useState<LabourItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [records, setRecords] = useState<SheetAtt[]>([]);
  const [payments, setPayments] = useState<SheetPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [labourModal, setLabourModal] = useState(false);
  const [teamModal, setTeamModal] = useState(false);
  const [listedKeys, setListedKeys] = useState<string[]>([]);

  const weekEnd = addDays(weekStart, 6);

  const loadPeople = useCallback(async () => {
    const [labourRes, teamRes] = await Promise.all([
      apiGet<Paginated<LabourItem>>("/api/v1/labours", { status: "active", page_size: 100 }),
      apiGet<Paginated<TeamItem>>("/api/v1/teams", { status: "active", page_size: 100 }),
    ]);
    setLabours(labourRes.items);
    setTeams(teamRes.items);
  }, []);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPeople();
      const params: Record<string, string | number> = {
        date_from: weekStart,
        date_to: weekEnd,
        page_size: 500,
      };
      if (entityFilter !== "all") params.entity_type = entityFilter;
      const [att, pmt] = await Promise.all([
        apiGet<{ items: SheetAtt[] }>("/api/v1/attendance/history", params),
        apiGet<{ items: SheetPayment[] }>("/api/v1/payments", { date_from: weekStart, date_to: weekEnd, page_size: 100 }),
      ]);
      setRecords(att.items);
      setPayments(pmt.items);
      const fromRecords = att.items.map((r) => (r.labour_id ? `labour-${r.labour_id}` : `team-${r.team_id}`));
      const merged = [...new Set([...readRoster(weekStart), ...fromRecords])];
      setListedKeys(merged);
      writeRoster(weekStart, merged);
    } catch {
      setError(t("attendance.loadErrorMark"));
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, entityFilter, t, loadPeople]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const allEntities: SheetEntity[] = useMemo(() => {
    const rows: SheetEntity[] = [];
    for (const l of labours) rows.push({ key: `labour-${l.id}`, id: l.id, kind: "labour", name: l.name });
    for (const tm of teams) rows.push({ key: `team-${tm.id}`, id: tm.id, kind: "team", name: tm.name, memberCount: tm.member_count });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [labours, teams]);

  const entities: SheetEntity[] = useMemo(() => {
    return allEntities.filter((e) => {
      if (!listedKeys.includes(e.key)) return false;
      if (entityFilter === "labour") return e.kind === "labour";
      if (entityFilter === "team") return e.kind === "team";
      return true;
    });
  }, [allEntities, listedKeys, entityFilter]);

  const availableToAdd = allEntities.filter((e) => !listedKeys.includes(e.key));

  function addToSheet(key: string) {
    if (!key || listedKeys.includes(key)) return;
    const next = [...listedKeys, key];
    setListedKeys(next);
    writeRoster(weekStart, next);
  }

  function removeFromSheet(entity: SheetEntity) {
    const next = listedKeys.filter((k) => k !== entity.key);
    setListedKeys(next);
    writeRoster(weekStart, next);
  }

  async function handleCellClick(entity: SheetEntity, date: string, current: SheetAtt | null) {
    const key = `${entity.key}:${date}`;
    const idx = CYCLE.indexOf(current?.status ?? null);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setSavingKey(key);
    try {
      if (next === null) {
        if (current?.id) {
          await apiDelete(`/api/v1/attendance/${current.id}`);
          setRecords((prev) => prev.filter((r) => r.id !== current.id));
        }
      } else {
        const body = {
          date,
          records: [
            {
              labour_id: entity.kind === "labour" ? entity.id : null,
              team_id: entity.kind === "team" ? entity.id : null,
              date,
              status: next,
              wage_type: "daily",
              num_labourers: entity.kind === "team" && next !== "absent" ? (entity.memberCount || 1) : null,
            },
          ],
        };
        const saved = await apiPost<SheetAtt[]>("/api/v1/attendance/bulk", body);
        setRecords((prev) => {
          const without = prev.filter((r) => !(r.date === date && (entity.kind === "labour" ? r.labour_id === entity.id : r.team_id === entity.id)));
          return [...without, ...saved];
        });
      }
    } catch {
      setError(t("attendance.saveErrorGeneric"));
    } finally {
      setSavingKey(null);
    }
  }

  const thisMonday = mondayOf(today);
  const todayHasMarks = records.some((r) => r.date === today);
  const markTitle = todayHasMarks ? t("dashboard.editAttendance") : t("attendance.markPageTitle");

  return (
    <>
      <title>{`${markTitle} | LabourBook`}</title>
      <LabourModal open={labourModal} onClose={() => setLabourModal(false)} onSuccess={() => { setLabourModal(false); loadPeople(); }} />
      <TeamModal open={teamModal} onClose={() => setTeamModal(false)} onSuccess={() => { setTeamModal(false); loadPeople(); }} />

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.eyebrow")}</p>
              <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", fontSize: "clamp(24px,5vw,32px)" }}>{markTitle}</h1>
              <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.markHint")}</p>
          </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <button type="button" onClick={() => setLabourModal(true)} className="h-12 px-4 rounded-xl text-body-md font-semibold" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
                {t("attendance.createLabourBtn")}
              </button>
              <button type="button" onClick={() => setTeamModal(true)} className="h-12 px-4 rounded-xl text-body-md font-semibold" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}>
                {t("attendance.createTeamBtn")}
                      </button>
                        </div>
                        </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ border: "1px solid var(--color-outline-variant)" }} aria-label={t("attendance.prev")}>
              <span className="material-symbols-outlined">chevron_left</span>
                        </button>
            <p className="text-body-md font-semibold min-w-[180px] text-center" style={{ color: "var(--color-on-surface)" }}>{formatWeekRange(weekStart)}</p>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ border: "1px solid var(--color-outline-variant)" }} aria-label={t("common.next")}>
              <span className="material-symbols-outlined">chevron_right</span>
                        </button>
            {weekStart !== thisMonday && (
              <button type="button" onClick={() => setWeekStart(thisMonday)} className="h-10 px-4 rounded-xl text-body-md font-semibold" style={{ backgroundColor: "var(--color-primary-fixed)", color: "var(--color-primary)" }}>
                {t("attendance.thisWeek")}
                      </button>
            )}
            <div className="flex gap-2 ml-auto flex-wrap">
              {(["all", "labour", "team"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setEntityFilter(key)} className="h-8 px-3 rounded-full text-body-md font-semibold"
                          style={{
                    backgroundColor: entityFilter === key ? "var(--color-primary)" : "var(--color-surface-container-low)",
                    color: entityFilter === key ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                  }}>
                  {key === "all" ? t("common.all") : key === "labour" ? t("attendance.labourersFilter") : t("attendance.teamsFilter")}
                      </button>
              ))}
                        </div>
                        </div>
        </header>

        <div className="px-4 md:px-8 pb-12 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-label-caps flex-1" style={{ color: "var(--color-on-surface-variant)" }}>
              ✓ {t("attendance.legendPresent")} · H {t("attendance.legendHalf")} · × {t("attendance.legendAbsent")}
            </p>
            {availableToAdd.length > 0 && (
              <div className="flex-1 sm:max-w-md">
                              <Select
                  className="w-full"
                  value=""
                  placeholder={t("attendance.addLabourOrTeam")}
                  options={availableToAdd.map((e) => ({
                    value: e.key,
                    label: e.kind === "team" ? `${e.name} (${t("attendance.teamsFilter")})` : e.name,
                  }))}
                  onChange={addToSheet}
                />
                          </div>
                        )}
                        </div>

          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-primary)" }} />
            </div>
          )}
          {!loading && error && (
            <div className="py-6 px-5 rounded-xl text-center" style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={loadWeek} className="px-5 py-2 rounded-lg text-body-md font-semibold" style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}>{t("attendance.tryAgain")}</button>
            </div>
          )}
          {!loading && !error && (
            <WeeklyAttendanceSheet
              weekStart={weekStart}
              entities={entities}
              records={records}
              payments={payments}
              interactive
              savingKey={savingKey}
              onCellClick={handleCellClick}
              onRemove={removeFromSheet}
            />
          )}
        </div>
      </div>
    </>
  );
}
