"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import WeeklyAttendanceSheet, {
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

export default function AttendancePage() {
  const { t } = useLanguage();
  const today = toISODate(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [entityFilter, setEntityFilter] = useState<"all" | "labour" | "team">("all");
  const [labours, setLabours] = useState<LabourItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [records, setRecords] = useState<SheetAtt[]>([]);
  const [payments, setPayments] = useState<SheetPayment[]>([]);
  const [todayMarked, setTodayMarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        date_from: weekStart,
        date_to: weekEnd,
        page_size: 500,
      };
      if (entityFilter !== "all") params.entity_type = entityFilter;

      const [att, pmt, labourRes, teamRes, todayAtt] = await Promise.all([
        apiGet<{ items: SheetAtt[] }>("/api/v1/attendance/history", params),
        apiGet<{ items: SheetPayment[] }>("/api/v1/payments", { date_from: weekStart, date_to: weekEnd, page_size: 100 }),
        apiGet<Paginated<LabourItem>>("/api/v1/labours", { status: "active", page_size: 100 }),
        apiGet<Paginated<TeamItem>>("/api/v1/teams", { status: "active", page_size: 100 }),
        apiGet<{ items: SheetAtt[] }>("/api/v1/attendance/history", { date_from: today, date_to: today, page_size: 1 }),
      ]);
      setRecords(att.items);
      setPayments(pmt.items);
      setLabours(labourRes.items);
      setTeams(teamRes.items);
      setTodayMarked(todayAtt.items.length > 0);
    } catch {
      setError(t("attendance.loadErrorHistory"));
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, entityFilter, t, today]);

  useEffect(() => { load(); }, [load]);

  const entities: SheetEntity[] = useMemo(() => {
    const byKey = new Map<string, SheetEntity>();
    for (const r of records) {
      if (r.labour_id) {
        if (entityFilter === "team") continue;
        const key = `labour-${r.labour_id}`;
        if (byKey.has(key)) continue;
        const name =
          r.labour?.name ??
          labours.find((l) => l.id === r.labour_id)?.name ??
          t("attendance.labourFallbackName");
        byKey.set(key, { key, id: r.labour_id, kind: "labour", name });
      } else if (r.team_id) {
        if (entityFilter === "labour") continue;
        const key = `team-${r.team_id}`;
        if (byKey.has(key)) continue;
        const tm = teams.find((x) => x.id === r.team_id);
        const name = r.team?.name ?? tm?.name ?? t("attendance.teamFallbackName");
        byKey.set(key, { key, id: r.team_id, kind: "team", name, memberCount: tm?.member_count });
      }
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [records, labours, teams, entityFilter, t]);

  const thisMonday = mondayOf(today);

  return (
    <>
      <title>{`${t("attendance.pageTitle")} | LabourBook`}</title>
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
        <header className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-label-caps mb-2" style={{ color: "var(--color-on-surface-variant)" }}>{t("attendance.eyebrow")}</p>
              <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", fontSize: "clamp(24px,5vw,32px)" }}>{t("attendance.pageTitle")}</h1>
            </div>
            <Link
              href="/attendance/mark"
              className="h-12 px-6 rounded-xl text-body-md font-semibold flex items-center gap-2 hover:opacity-90 self-start sm:self-auto"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>{todayMarked ? "edit" : "edit_calendar"}</span>
              {todayMarked ? t("dashboard.editAttendance") : t("attendance.markTodaysAttendance")}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }} aria-label={t("attendance.prev")}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <p className="text-body-md font-semibold min-w-[180px] text-center" style={{ color: "var(--color-on-surface)" }}>{formatWeekRange(weekStart)}</p>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }} aria-label={t("common.next")}>
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
          <p className="text-label-caps" style={{ color: "var(--color-on-surface-variant)" }}>
            ✓ {t("attendance.legendPresent")} · H {t("attendance.legendHalf")} · × {t("attendance.legendAbsent")}
          </p>

          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-primary)" }} />
            </div>
          )}
          {!loading && error && (
            <div className="py-6 px-5 rounded-xl text-center" style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
              <p className="text-body-md font-semibold mb-2">{error}</p>
              <button onClick={load} className="px-5 py-2 rounded-lg text-body-md font-semibold" style={{ backgroundColor: "var(--color-on-error-container)", color: "var(--color-error-container)" }}>{t("attendance.tryAgain")}</button>
            </div>
          )}
          {!loading && !error && (
            <WeeklyAttendanceSheet weekStart={weekStart} entities={entities} records={records} payments={payments} />
          )}
        </div>
      </div>
    </>
  );
}
