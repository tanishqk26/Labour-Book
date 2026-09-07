"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatMediumDate, getInitials } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatementEntity {
  id: string;
  name: string;
  entity_type: "individual" | "team";
  daily_wage: number;
  hometown?: string;
  is_active: boolean;
}

interface EntityInfo {
  id: string;
  name: string;
  entity_type: "individual" | "team";
  daily_wage: number;
  hometown?: string;
  phone?: string;
  aadhaar?: string;
  car_rent?: number;
  manager_fee?: number;
  member_count?: number;
}

interface StatementSummary {
  total_days_present: number;
  total_days_absent: number;
  total_days_half: number;
  total_wage_earned: number;
  total_paid_borrowed: number;
  total_wage_credited: number;
  balance: number;
}

interface WorkRow {
  date: string;
  status: "present" | "absent" | "half_day";
  task?: string;
  hours_worked?: number;
  work_start_time?: string;
  work_end_time?: string;
  num_labourers?: number;
  wage_earned: number;
}

interface PaymentRow {
  date: string;
  type: "credit" | "borrowed";
  description: string;
  amount: number;
  method?: string;
  notes?: string;
}

interface WorkStatement {
  entity: EntityInfo;
  date_from: string;
  date_to: string;
  rows: WorkRow[];
  summary: StatementSummary;
}

interface PaymentStatement {
  entity: EntityInfo;
  date_from: string;
  date_to: string;
  rows: PaymentRow[];
  summary: StatementSummary;
}

interface CombinedStatement {
  entity: EntityInfo;
  date_from: string;
  date_to: string;
  work_rows: WorkRow[];
  payment_rows: PaymentRow[];
  summary: StatementSummary;
}

type StatementType = "work" | "payment" | "combined";
type AnyStatement = WorkStatement | PaymentStatement | CombinedStatement;

// ─── Constants ────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 20;

const AVATAR_COLORS = [
  { bg: "#c1ecd4", color: "#012d1d" },
  { bg: "#d7e4f0", color: "#111d25" },
  { bg: "#fef3c7", color: "#6b4c04" },
  { bg: "#ffdad3", color: "#510900" },
  { bg: "#e8d5f7", color: "#3d1457" },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}
function fmtCur(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// ─── Ledger row helper for combined / payment ─────────────────────────────────

interface LedgerRow {
  date: string;
  rowType: "work" | "payment";
  description: string;
  status?: string;
  numWorkersOrHours?: string;
  credited: number;
  borrowed: number;
  runningBalance: number;
}

function buildLedgerRows(workRows: WorkRow[], payRows: PaymentRow[]): LedgerRow[] {
  // merge and sort by date
  const all: Array<{ date: string; src: "work" | "pay"; data: WorkRow | PaymentRow }> = [
    ...workRows.map(r => ({ date: r.date, src: "work" as const, data: r })),
    ...payRows.filter(r => r.type === "borrowed").map(r => ({ date: r.date, src: "pay" as const, data: r })),
  ];
  all.sort((a, b) => a.date.localeCompare(b.date));

  let balance = 0;
  return all.map(item => {
    if (item.src === "work") {
      const w = item.data as WorkRow;
      const credited = w.status !== "absent" ? w.wage_earned : 0;
      balance += credited;
      const statusLabel = w.status === "present" ? "Present" : w.status === "half_day" ? "Half Day" : "Absent";
      const workerInfo = w.num_labourers ? `${w.num_labourers} workers` : w.hours_worked ? `${w.hours_worked}h` : "";
      return {
        date: w.date,
        rowType: "work" as const,
        description: w.task ? `${statusLabel} — ${w.task}` : `Daily Work (${statusLabel})`,
        status: w.status,
        numWorkersOrHours: workerInfo,
        credited,
        borrowed: 0,
        runningBalance: balance,
      };
    } else {
      const p = item.data as PaymentRow;
      balance -= p.amount;
      return {
        date: p.date,
        rowType: "payment" as const,
        description: p.description,
        status: undefined,
        numWorkersOrHours: p.method ? p.method.replace(/_/g, " ") : "",
        credited: 0,
        borrowed: p.amount,
        runningBalance: balance,
      };
    }
  });
}

// ─── Professional Statement HTML Generator ────────────────────────────────────

function generateStatementHTML(
  entity: EntityInfo,
  summary: StatementSummary,
  workRows: WorkRow[],
  payRows: PaymentRow[],
  statementType: StatementType,
  dateFrom: string,
  dateTo: string
): string {
  const typeLabel =
    statementType === "work" ? "Work Statement" :
    statementType === "payment" ? "Payment Statement" :
    "Combined Statement";

  const periodLabel = `${dateFrom ? fmtDate(dateFrom) : "—"} to ${dateTo ? fmtDate(dateTo) : "—"}`;
  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const isTeam = entity.entity_type === "team";

  // ── entity info rows ──
  const infoRows = [
    ["Name", entity.name],
    ["Type", isTeam ? "Team" : "Individual Labour"],
    entity.hometown ? ["Hometown / Origin", entity.hometown] : null,
    entity.phone ? ["Phone", entity.phone] : null,
    entity.aadhaar ? ["Aadhaar", entity.aadhaar] : null,
    ["Daily Wage", fmtCur(entity.daily_wage)],
    entity.car_rent ? ["Car Rent", fmtCur(entity.car_rent)] : null,
    entity.manager_fee ? ["Manager Fee", fmtCur(entity.manager_fee)] : null,
    entity.member_count !== undefined ? ["Team Members", String(entity.member_count)] : null,
  ].filter(Boolean) as [string, string][];

  // ── summary rows ──
  const summaryItems = [
    `<span>Days Present: <b>${summary.total_days_present}</b></span>`,
    `<span>Days Absent: <b>${summary.total_days_absent}</b></span>`,
    `<span>Half Days: <b>${summary.total_days_half}</b></span>`,
    `<span>Total Earned: <b>${fmtCur(summary.total_wage_earned)}</b></span>`,
    `<span>Total Borrowed: <b>${fmtCur(summary.total_paid_borrowed)}</b></span>`,
    `<span style="color:${summary.balance >= 0 ? "#166534" : "#991b1b"}">Balance: <b>${fmtCur(Math.abs(summary.balance))} ${summary.balance < 0 ? "(Overpaid)" : summary.balance === 0 ? "(Settled)" : "(Pending)"}</b></span>`,
  ];

  // ── table HTML ──
  let tableHTML = "";

  if (statementType === "work") {
    const headerBg = "#1b4332";
    const rows = workRows.map((r, i) => {
      const statusLabel = r.status === "present" ? "Present" : r.status === "half_day" ? "Half Day" : "Absent";
      const statusColor = r.status === "present" ? "#166534" : r.status === "half_day" ? "#92400e" : "#991b1b";
      const workerInfo = isTeam && r.num_labourers ? `${r.num_labourers} workers` : r.hours_worked ? `${r.hours_worked}h` : "—";
      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8faf9";
      return `<tr style="background:${rowBg};border-bottom:1px solid #e5e7eb;">
        <td style="padding:9px 14px;font-size:13px;color:#374151;white-space:nowrap;">${fmtDate(r.date)}</td>
        <td style="padding:9px 14px;"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;background:${statusColor}22;color:${statusColor};">${statusLabel}</span></td>
        <td style="padding:9px 14px;font-size:13px;color:#374151;max-width:200px;">${r.task || "<em style='color:#9ca3af;'>—</em>"}</td>
        <td style="padding:9px 14px;font-size:13px;color:#374151;text-align:center;">${workerInfo}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:600;text-align:right;color:${r.status === "absent" ? "#9ca3af" : "#166534"};">${r.status === "absent" ? "—" : fmtCur(r.wage_earned)}</td>
      </tr>`;
    }).join("");

    const totalWage = workRows.reduce((s, r) => s + r.wage_earned, 0);

    tableHTML = `
      <table style="width:100%;border-collapse:collapse;font-family:Inter,sans-serif;">
        <thead>
          <tr style="background:${headerBg};color:#ffffff;">
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;white-space:nowrap;">Date</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;">Status</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;">Task Description</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:center;">${isTeam ? "Workers" : "Hours"}</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:right;">Wage Earned</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f0fdf4;border-top:2px solid #1b4332;">
            <td colspan="4" style="padding:11px 14px;font-size:13px;font-weight:700;color:#1b4332;">TOTAL WAGE EARNED</td>
            <td style="padding:11px 14px;font-size:14px;font-weight:800;color:#1b4332;text-align:right;">${fmtCur(totalWage)}</td>
          </tr>
        </tfoot>
      </table>`;

  } else {
    // Payment or Combined — single ledger table
    let ledgerRows: LedgerRow[] = [];

    if (statementType === "payment") {
      // Build ledger from payment rows only (credits from attendance wages + borrowed)
      const creditRows = payRows.filter(r => r.type === "credit");
      const borrowedRows = payRows.filter(r => r.type === "borrowed");
      // Merge credit rows (wages) with borrowed rows
      const allPay: Array<{date: string; isCredit: boolean; desc: string; amount: number; method?: string}> = [
        ...creditRows.map(r => ({ date: r.date, isCredit: true, desc: r.description, amount: r.amount, method: r.method })),
        ...borrowedRows.map(r => ({ date: r.date, isCredit: false, desc: r.description, amount: r.amount, method: r.method })),
      ];
      allPay.sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0;
      ledgerRows = allPay.map(r => {
        if (r.isCredit) { bal += r.amount; return { date: r.date, rowType: "work" as const, description: r.desc, status: "present", numWorkersOrHours: "", credited: r.amount, borrowed: 0, runningBalance: bal }; }
        else { bal -= r.amount; return { date: r.date, rowType: "payment" as const, description: r.desc, status: undefined, numWorkersOrHours: r.method ? r.method.replace(/_/g, " ") : "", credited: 0, borrowed: r.amount, runningBalance: bal }; }
      });
    } else {
      // Combined
      ledgerRows = buildLedgerRows(workRows, payRows);
    }

    const totalCredited = ledgerRows.reduce((s, r) => s + r.credited, 0);
    const totalBorrowed = ledgerRows.reduce((s, r) => s + r.borrowed, 0);
    const finalBalance = totalCredited - totalBorrowed;
    const headerBg = "#1b4332";

    const rows = ledgerRows.map((r, i) => {
      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8faf9";
      const isWork = r.rowType === "work";
      const balColor = r.runningBalance < 0 ? "#991b1b" : "#166534";
      const typeLabel = isWork
        ? `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:9999px;background:#dcfce7;color:#166534;">Wage</span>`
        : `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:9999px;background:#fee2e2;color:#991b1b;">Advance</span>`;

      const cols = statementType === "combined"
        ? `<td style="padding:9px 14px;">${typeLabel}</td>`
        : "";

      return `<tr style="background:${rowBg};border-bottom:1px solid #e5e7eb;">
        <td style="padding:9px 14px;font-size:13px;color:#374151;white-space:nowrap;">${fmtDate(r.date)}</td>
        ${cols}
        <td style="padding:9px 14px;font-size:13px;color:#374151;">${r.description}${r.numWorkersOrHours ? `<br><span style="font-size:11px;color:#9ca3af;text-transform:capitalize;">${r.numWorkersOrHours}</span>` : ""}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:600;text-align:right;color:#166534;">${r.credited > 0 ? "+ " + fmtCur(r.credited) : "—"}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:600;text-align:right;color:#991b1b;">${r.borrowed > 0 ? "− " + fmtCur(r.borrowed) : "—"}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:700;text-align:right;color:${balColor};">${fmtCur(Math.abs(r.runningBalance))}${r.runningBalance < 0 ? ' <span style="font-size:10px;">(Dr)</span>' : ""}</td>
      </tr>`;
    }).join("");

    const typeColHeader = statementType === "combined"
      ? `<th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;">Type</th>`
      : "";

    tableHTML = `
      <table style="width:100%;border-collapse:collapse;font-family:Inter,sans-serif;">
        <thead>
          <tr style="background:${headerBg};color:#ffffff;">
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;white-space:nowrap;">Date</th>
            ${typeColHeader}
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;">Description</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:right;white-space:nowrap;">Credited (+)</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:right;white-space:nowrap;">Borrowed (−)</th>
            <th style="padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:right;">Balance</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f0fdf4;border-top:2px solid #1b4332;">
            <td colspan="${statementType === "combined" ? 3 : 2}" style="padding:11px 14px;font-size:13px;font-weight:700;color:#1b4332;">TOTALS</td>
            <td style="padding:11px 14px;font-size:14px;font-weight:800;color:#166534;text-align:right;">${fmtCur(totalCredited)}</td>
            <td style="padding:11px 14px;font-size:14px;font-weight:800;color:#991b1b;text-align:right;">${fmtCur(totalBorrowed)}</td>
            <td style="padding:11px 14px;font-size:14px;font-weight:800;text-align:right;color:${finalBalance >= 0 ? "#1b4332" : "#991b1b"};">${fmtCur(Math.abs(finalBalance))}${finalBalance < 0 ? " (Dr)" : ""}</td>
          </tr>
        </tfoot>
      </table>`;
  }

  const emptyMsg = workRows.length === 0 && payRows.length === 0
    ? `<p style="text-align:center;color:#9ca3af;padding:32px;font-size:14px;">No records found for the selected date range.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${typeLabel} — ${entity.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;color:#111827;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@page{margin:1.5cm;size:A4;}
table{border-collapse:collapse;width:100%;}
</style>
</head>
<body style="padding:36px 40px;">

<!-- TITLE SECTION -->
<div style="margin-bottom:24px;">
  <p style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">LabourBook · Farm Labour Management</p>
  <h1 style="font-size:32px;font-weight:800;color:#111827;line-height:1.1;">${typeLabel}</h1>
</div>

<!-- DIVIDER -->
<div style="border-top:3px solid #1b4332;margin-bottom:24px;"></div>

<!-- ENTITY INFO + DATE -->
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
<tr>
<td style="vertical-align:top;width:60%;">
  ${infoRows.map(([label, value]) =>
    `<div style="display:flex;gap:8px;margin-bottom:5px;">
      <span style="font-size:13px;color:#6b7280;width:140px;flex-shrink:0;">${label}</span>
      <span style="font-size:13px;font-weight:600;color:#111827;">${value}</span>
    </div>`
  ).join("")}
</td>
<td style="vertical-align:top;text-align:right;width:40%;">
  <div style="margin-bottom:5px;">
    <span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Period</span><br>
    <span style="font-size:13px;font-weight:600;color:#111827;">${periodLabel}</span>
  </div>
  <div style="margin-top:10px;">
    <span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Generated</span><br>
    <span style="font-size:13px;color:#374151;">${generatedOn}</span>
  </div>
</td>
</tr>
</table>

<!-- TABLE -->
<div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
  ${tableHTML}
  ${emptyMsg}
</div>

<!-- SUMMARY BAR -->
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 18px;margin-bottom:32px;">
  <p style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Statement Summary</p>
  <div style="display:flex;flex-wrap:wrap;gap:16px;">
    ${summaryItems.map(s => `<span style="font-size:13px;color:#374151;">${s}</span>`).join("")}
  </div>
</div>

<!-- FOOTER -->
<div style="border-top:1px solid #e5e7eb;padding-top:14px;display:flex;justify-content:space-between;align-items:center;">
  <p style="font-size:11px;color:#9ca3af;">LabourBook · This statement is computer-generated.</p>
  <p style="font-size:11px;color:#9ca3af;">Statement for: <b style="color:#374151;">${entity.name}</b></p>
</div>

</body>
</html>`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatementsPage() {
  const [step, setStep] = useState<"select" | "configure" | "view">("select");
  const [entities, setEntities] = useState<StatementEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<StatementEntity | null>(null);
  const [statementType, setStatementType] = useState<StatementType>("combined");
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [statement, setStatement] = useState<AnyStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setEntitiesLoading(true);
    apiGet<StatementEntity[]>("/api/v1/statements/entities")
      .then(setEntities)
      .catch(() => setEntities([]))
      .finally(() => setEntitiesLoading(false));
  }, []);

  const fetchStatement = useCallback(async () => {
    if (!selectedEntity) return;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await apiGet<AnyStatement>(
        `/api/v1/statements/${statementType}/${selectedEntity.entity_type}/${selectedEntity.id}`,
        params
      );
      setStatement(data);
      setStep("view");
    } catch {
      setError("Failed to load statement. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedEntity, statementType, dateFrom, dateTo]);

  // Derived data
  const workRows: WorkRow[] = (() => {
    if (!statement) return [];
    if ("work_rows" in statement) return (statement as CombinedStatement).work_rows;
    if ("rows" in statement) {
      const rows = (statement as WorkStatement | PaymentStatement).rows;
      if (rows.length > 0 && "status" in rows[0]) return rows as WorkRow[];
    }
    return [];
  })();

  const payRows: PaymentRow[] = (() => {
    if (!statement) return [];
    if ("payment_rows" in statement) return (statement as CombinedStatement).payment_rows;
    if ("rows" in statement) {
      const rows = (statement as WorkStatement | PaymentStatement).rows;
      if (rows.length > 0 && "type" in rows[0]) return rows as PaymentRow[];
    }
    return [];
  })();

  // PDF download via hidden iframe (no new window opened)
  const handleConfirmDownload = () => {
    if (!statement) return;
    const html = generateStatementHTML(
      statement.entity,
      statement.summary,
      workRows,
      payRows,
      statementType,
      dateFrom,
      dateTo
    );
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 800);
    setShowConfirm(false);
  };

  const filteredEntities = entities.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.hometown ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Ledger rows for preview
  const isTeam = statement?.entity?.entity_type === "team";
  const ledgerRows = (statementType === "payment" || statementType === "combined")
    ? (() => {
        if (statementType === "payment") {
          const allPay = [
            ...payRows.filter(r => r.type === "credit").map(r => ({ date: r.date, isCredit: true, desc: r.description, amount: r.amount, method: r.method })),
            ...payRows.filter(r => r.type === "borrowed").map(r => ({ date: r.date, isCredit: false, desc: r.description, amount: r.amount, method: r.method })),
          ];
          allPay.sort((a, b) => a.date.localeCompare(b.date));
          let bal = 0;
          return allPay.map(r => {
            if (r.isCredit) { bal += r.amount; return { date: r.date, rowType: "work" as const, description: r.desc, status: "present", numWorkersOrHours: "", credited: r.amount, borrowed: 0, runningBalance: bal }; }
            else { bal -= r.amount; return { date: r.date, rowType: "payment" as const, description: r.desc, status: undefined, numWorkersOrHours: r.method || "", credited: 0, borrowed: r.amount, runningBalance: bal }; }
          });
        }
        return buildLedgerRows(workRows, payRows);
      })()
    : [];

  // pagination for view
  const allDisplayRows = statementType === "work" ? workRows : ledgerRows;
  const totalPages = Math.max(1, Math.ceil(allDisplayRows.length / ROWS_PER_PAGE));
  const pageRows = allDisplayRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <>
      <title>Statements | LabourBook</title>

      {/* ── Confirmation Modal ── */}
      {showConfirm && statement && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: "var(--color-surface-container-lowest)",
              borderRadius: 20,
              padding: "32px",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "var(--color-primary-container)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined icon-fill" style={{ color: "var(--color-on-primary)", fontSize: 22 }}>download</span>
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 17, color: "var(--color-on-surface)" }}>Download Statement</p>
                <p style={{ fontSize: 13, color: "var(--color-on-surface-variant)", marginTop: 2 }}>
                  {statementType === "work" ? "Work" : statementType === "payment" ? "Payment" : "Combined"} Statement for <b>{statement.entity.name}</b>
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: "var(--color-surface-container)", borderRadius: 12, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: "var(--color-on-surface-variant)", lineHeight: 1.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Period</span>
                <span style={{ fontWeight: 600, color: "var(--color-on-surface)" }}>
                  {dateFrom ? fmtDate(dateFrom) : "All time"} – {dateTo ? fmtDate(dateTo) : "Today"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span>Type</span>
                <span style={{ fontWeight: 600, color: "var(--color-on-surface)" }}>
                  {statementType === "work" ? "Work Statement" : statementType === "payment" ? "Payment Statement" : "Combined Statement"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span>Records</span>
                <span style={{ fontWeight: 600, color: "var(--color-on-surface)" }}>
                  {allDisplayRows.length} entries
                </span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--color-on-surface-variant)", marginBottom: 20, lineHeight: 1.5 }}>
              The print dialog will open. Select <b>Save as PDF</b> to download the statement.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, border: "1.5px solid var(--color-outline-variant)", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--color-on-surface)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDownload}
                style={{ flex: 2, height: 44, borderRadius: 12, border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <header className="px-4 md:px-[var(--spacing-container-margin)] py-8 md:py-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg" style={{ color: "var(--color-primary)", fontSize: "clamp(24px, 5vw, 32px)" }}>
            Statements
          </h1>
          <p className="text-body-lg mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Generate work &amp; payment statements for labours and teams.
          </p>
        </div>
        {step !== "select" && (
          <div className="flex gap-3">
            {step === "view" && (
              <button
                id="download-pdf-btn"
                onClick={() => setShowConfirm(true)}
                className="h-11 px-5 rounded-[var(--radius-DEFAULT)] text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>download</span>
                Download PDF
              </button>
            )}
            <button
              onClick={() => { setStep("select"); setStatement(null); setSelectedEntity(null); }}
              className="h-11 px-5 rounded-[var(--radius-DEFAULT)] text-body-md font-semibold flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-on-surface)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
              New Statement
            </button>
          </div>
        )}
      </header>

      <div className="px-4 md:px-[var(--spacing-container-margin)] pb-12">

        {/* ══ STEP 1: SELECT ══ */}
        {step === "select" && (
          <div className="flex flex-col gap-6">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}
            >
              <span className="material-symbols-outlined" style={{ color: "var(--color-on-surface-variant)", fontSize: "22px" }}>search</span>
              <input
                id="entity-search"
                type="text"
                placeholder="Search labour or team by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-body-md"
                style={{ color: "var(--color-on-surface)" }}
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-outline)" }}>close</span>
                </button>
              )}
            </div>

            {entitiesLoading ? (
              <div className="flex flex-col items-center py-24 gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-primary)" }} />
                <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Loading…</p>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <span className="material-symbols-outlined" style={{ fontSize: 56, color: "var(--color-outline)" }}>person_search</span>
                <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>No results found</p>
              </div>
            ) : (
              <div>
                <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>Select a labour or team</p>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {filteredEntities.map((entity, idx) => {
                    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <button
                        key={entity.id}
                        id={`entity-card-${entity.id}`}
                        onClick={() => { setSelectedEntity(entity); setStep("configure"); }}
                        className="card-hover text-left rounded-2xl px-5 py-4 flex items-center gap-4"
                        style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}
                      >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-body-md font-bold flex-shrink-0"
                          style={{ backgroundColor: color.bg, color: color.color }}>
                          {getInitials(entity.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>{entity.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-label-caps px-2 py-0.5 rounded-full" style={{
                              backgroundColor: entity.entity_type === "team" ? "var(--color-secondary-container)" : "var(--color-primary-container)",
                              color: entity.entity_type === "team" ? "var(--color-on-secondary-container)" : "var(--color-on-primary-container)",
                            }}>
                              {entity.entity_type === "team" ? "Team" : "Labour"}
                            </span>
                            {entity.hometown && <span className="text-label-caps truncate" style={{ color: "var(--color-outline)" }}>{entity.hometown}</span>}
                          </div>
                          <p className="text-label-caps mt-1" style={{ color: "var(--color-on-surface-variant)" }}>₹{entity.daily_wage}/day</p>
                        </div>
                        <span className="material-symbols-outlined" style={{ color: "var(--color-outline)", fontSize: "20px" }}>chevron_right</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 2: CONFIGURE ══ */}
        {step === "configure" && selectedEntity && (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            {/* Entity card */}
            <div className="rounded-2xl px-6 py-5 flex items-center gap-4"
              style={{ backgroundColor: "var(--color-surface-container-low)", border: "1px solid var(--color-outline-variant)" }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-body-lg font-bold flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary-container)", color: "var(--color-on-primary)" }}>
                {getInitials(selectedEntity.name)}
              </div>
              <div className="flex-1">
                <p className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{selectedEntity.name}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="text-label-caps px-2 py-0.5 rounded-full" style={{
                    backgroundColor: selectedEntity.entity_type === "team" ? "var(--color-secondary-container)" : "var(--color-primary-container)",
                    color: selectedEntity.entity_type === "team" ? "var(--color-on-secondary-container)" : "var(--color-on-primary-container)",
                  }}>
                    {selectedEntity.entity_type === "team" ? "Team" : "Individual Labour"}
                  </span>
                  {selectedEntity.hometown && <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>{selectedEntity.hometown}</span>}
                  <span className="text-label-caps" style={{ color: "var(--color-outline)" }}>₹{selectedEntity.daily_wage}/day</span>
                </div>
              </div>
              <button onClick={() => setStep("select")}
                className="text-label-caps px-3 py-1.5 rounded-lg"
                style={{ color: "var(--color-primary)", backgroundColor: "var(--color-surface-container)" }}>
                Change
              </button>
            </div>

            {/* Statement type */}
            <div>
              <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>Statement Type</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: "work" as StatementType, icon: "assignment", label: "Work Statement", desc: "Attendance & task records" },
                  { value: "payment" as StatementType, icon: "account_balance_wallet", label: "Payment Statement", desc: "Earnings & advances ledger" },
                  { value: "combined" as StatementType, icon: "summarize", label: "Combined", desc: "Single unified ledger" },
                ].map(opt => (
                  <button key={opt.value} id={`stmt-type-${opt.value}`} onClick={() => setStatementType(opt.value)}
                    className="rounded-2xl px-5 py-4 text-left transition-all"
                    style={{
                      border: statementType === opt.value ? "2px solid var(--color-primary)" : "1.5px solid var(--color-outline-variant)",
                      backgroundColor: statementType === opt.value ? "var(--color-primary-container)" : "var(--color-surface-container-lowest)",
                    }}>
                    <span className="material-symbols-outlined icon-fill mb-2 block" style={{ fontSize: "28px", color: statementType === opt.value ? "var(--color-on-primary)" : "var(--color-on-surface-variant)" }}>
                      {opt.icon}
                    </span>
                    <p className="text-body-md font-semibold" style={{ color: statementType === opt.value ? "var(--color-on-primary)" : "var(--color-on-surface)" }}>{opt.label}</p>
                    <p className="text-label-caps mt-0.5" style={{ color: statementType === opt.value ? "var(--color-on-primary-container)" : "var(--color-outline)" }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <p className="text-label-caps mb-3" style={{ color: "var(--color-on-surface-variant)" }}>Date Range</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: "This Month", fn: () => { setDateFrom(firstOfMonthISO()); setDateTo(todayISO()); } },
                  { label: "Last Month", fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth()-1, 1).toISOString().slice(0,10)); setDateTo(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0,10)); } },
                  { label: "Last 3 Months", fn: () => { const d = new Date(); setDateFrom(new Date(d.getFullYear(), d.getMonth()-3, 1).toISOString().slice(0,10)); setDateTo(todayISO()); } },
                  { label: "This Year", fn: () => { setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(todayISO()); } },
                ].map(p => (
                  <button key={p.label} onClick={p.fn}
                    className="text-label-caps px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-on-surface-variant)" }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "From", value: dateFrom, onChange: setDateFrom },
                  { label: "To", value: dateTo, onChange: setDateTo },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-label-caps block mb-1.5" style={{ color: "var(--color-on-surface-variant)" }}>{f.label}</label>
                    <div className="relative rounded-[var(--radius-DEFAULT)] overflow-hidden"
                      style={{ border: "1.5px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-lowest)" }}>
                      <input type="date" value={f.value} onChange={e => f.onChange(e.target.value)}
                        className="w-full px-4 py-3 text-body-md bg-transparent outline-none"
                        style={{ color: "var(--color-on-surface)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
                <p className="text-body-md font-semibold">{error}</p>
              </div>
            )}

            <button id="generate-statement-btn" onClick={fetchStatement} disabled={loading}
              className="h-14 rounded-[var(--radius-DEFAULT)] text-body-md font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
              {loading ? (
                <><div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-white" />Generating…</>
              ) : (
                <><span className="material-symbols-outlined icon-fill" style={{ fontSize: "20px" }}>receipt_long</span>Generate Statement</>
              )}
            </button>
          </div>
        )}

        {/* ══ STEP 3: VIEW ══ */}
        {step === "view" && statement && (
          <div>
            {/* Action bar */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button onClick={() => setStep("configure")}
                className="h-10 px-4 rounded-xl text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-surface-container)", color: "var(--color-on-surface)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>tune</span>
                Adjust Filters
              </button>
              <button onClick={() => setShowConfirm(true)}
                className="h-10 px-4 rounded-xl text-body-md font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>download</span>
                Download PDF
              </button>
            </div>

            {/* ── Professional Statement Preview ── */}
            <div style={{
              backgroundColor: "#fff",
              border: "1px solid var(--color-outline-variant)",
              borderRadius: 16,
              padding: "36px 40px",
              fontFamily: "Inter, sans-serif",
              maxWidth: 900,
            }}>

              {/* Title */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
                  LabourBook · Farm Labour Management
                </p>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
                  {statementType === "work" ? "Work Statement" : statementType === "payment" ? "Payment Statement" : "Combined Statement"}
                </h2>
              </div>

              {/* Divider */}
              <div style={{ borderTop: "3px solid #1b4332", marginBottom: 24 }} />

              {/* Entity info + period */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                <div>
                  {[
                    ["Name", statement.entity.name],
                    ["Type", statement.entity.entity_type === "team" ? "Team" : "Individual Labour"],
                    statement.entity.hometown ? ["Hometown", statement.entity.hometown] : null,
                    statement.entity.phone ? ["Phone", statement.entity.phone] : null,
                    ["Daily Wage", formatCurrency(statement.entity.daily_wage)],
                    statement.entity.car_rent != null ? ["Car Rent", formatCurrency(statement.entity.car_rent)] : null,
                    statement.entity.manager_fee != null ? ["Manager Fee", formatCurrency(statement.entity.manager_fee)] : null,
                    statement.entity.member_count != null ? ["Members", String(statement.entity.member_count)] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label as string} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: "#6b7280", width: 120, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280" }}>Period</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 4 }}>
                    {dateFrom ? fmtDate(dateFrom) : "All time"} – {dateTo ? fmtDate(dateTo) : "Today"}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280", marginTop: 12 }}>Generated</p>
                  <p style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
                    {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", marginBottom: 20 }}>
                {statementType === "work" ? (
                  <PreviewWorkTable rows={pageRows as WorkRow[]} allRows={workRows} entity={statement.entity} />
                ) : (
                  <PreviewLedgerTable
                    rows={pageRows as LedgerRow[]}
                    allRows={ledgerRows}
                    summary={statement.summary}
                    showTypeCol={statementType === "combined"}
                  />
                )}
                {allDisplayRows.length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af", fontSize: 14 }}>
                    No records found for the selected date range.
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>
                    Showing {(currentPage-1)*ROWS_PER_PAGE+1}–{Math.min(currentPage*ROWS_PER_PAGE, allDisplayRows.length)} of {allDisplayRows.length} records
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p-1))}
                      disabled={currentPage === 1}
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: currentPage === 1 ? "#f9fafb" : "#fff", cursor: currentPage === 1 ? "default" : "pointer", color: "#374151", fontSize: 18 }}
                    >‹</button>
                    <span style={{ fontSize: 13, color: "#374151", padding: "0 12px", lineHeight: "32px" }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}
                      disabled={currentPage === totalPages}
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: currentPage === totalPages ? "#f9fafb" : "#fff", cursor: currentPage === totalPages ? "default" : "pointer", color: "#374151", fontSize: 18 }}
                    >›</button>
                  </div>
                </div>
              )}

              {/* Summary bar */}
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "14px 18px", marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>
                  Statement Summary
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
                  {[
                    { label: "Days Present", value: String(statement.summary.total_days_present), color: "#166534" },
                    { label: "Days Absent", value: String(statement.summary.total_days_absent), color: "#991b1b" },
                    { label: "Half Days", value: String(statement.summary.total_days_half), color: "#92400e" },
                    { label: "Total Earned", value: formatCurrency(statement.summary.total_wage_earned), color: "#166534" },
                    { label: "Total Borrowed", value: formatCurrency(statement.summary.total_paid_borrowed), color: "#991b1b" },
                    {
                      label: "Balance",
                      value: formatCurrency(Math.abs(statement.summary.balance)) + (statement.summary.balance < 0 ? " (Overpaid)" : statement.summary.balance === 0 ? " (Settled)" : " (Pending)"),
                      color: statement.summary.balance >= 0 ? "#1b4332" : "#991b1b",
                    },
                  ].map(s => (
                    <div key={s.label} style={{ fontSize: 13, color: "#374151" }}>
                      <span style={{ color: "#6b7280" }}>{s.label}: </span>
                      <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 11, color: "#9ca3af" }}>LabourBook · This statement is computer-generated.</p>
                <p style={{ fontSize: 11, color: "#9ca3af" }}>
                  Statement for: <b style={{ color: "#374151" }}>{statement.entity.name}</b>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Preview Table Components ─────────────────────────────────────────────────

function PreviewWorkTable({ rows, allRows, entity }: { rows: WorkRow[]; allRows: WorkRow[]; entity: EntityInfo }) {
  const isTeam = entity.entity_type === "team";
  const COL_H = { padding: "11px 14px", fontSize: 11, fontWeight: 600 as const, letterSpacing: ".06em" as const, textTransform: "uppercase" as const, background: "#1b4332", color: "#fff", textAlign: "left" as const, whiteSpace: "nowrap" as const };
  const totalWage = allRows.reduce((s, r) => s + r.wage_earned, 0);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={COL_H}>Date</th>
          <th style={COL_H}>Status</th>
          <th style={COL_H}>Task Description</th>
          <th style={{ ...COL_H, textAlign: "center" }}>{isTeam ? "Workers" : "Hours"}</th>
          <th style={{ ...COL_H, textAlign: "right" as const }}>Wage Earned</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const statusLabel = r.status === "present" ? "Present" : r.status === "half_day" ? "Half Day" : "Absent";
          const statusColor = r.status === "present" ? "#166534" : r.status === "half_day" ? "#92400e" : "#991b1b";
          const workerInfo = isTeam && r.num_labourers ? `${r.num_labourers} workers` : r.hours_worked ? `${r.hours_worked}h` : "—";
          return (
            <tr key={`${r.date}-${i}`} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f8faf9" }}>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
              <td style={{ padding: "9px 14px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: `${statusColor}22`, color: statusColor }}>{statusLabel}</span>
              </td>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#374151" }}>{r.task || <em style={{ color: "#9ca3af" }}>—</em>}</td>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#374151", textAlign: "center" }}>{workerInfo}</td>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, textAlign: "right", color: r.status === "absent" ? "#9ca3af" : "#166534" }}>
                {r.status === "absent" ? "—" : formatCurrency(r.wage_earned)}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ background: "#f0fdf4", borderTop: "2px solid #1b4332" }}>
          <td colSpan={4} style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "#1b4332" }}>TOTAL WAGE EARNED ({allRows.length} records)</td>
          <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 800, color: "#1b4332", textAlign: "right" }}>{formatCurrency(totalWage)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function PreviewLedgerTable({ rows, allRows, summary, showTypeCol }: { rows: LedgerRow[]; allRows: LedgerRow[]; summary: StatementSummary; showTypeCol: boolean }) {
  const COL_H = { padding: "11px 14px", fontSize: 11, fontWeight: 600 as const, letterSpacing: ".06em" as const, textTransform: "uppercase" as const, background: "#1b4332", color: "#fff", textAlign: "left" as const, whiteSpace: "nowrap" as const };
  const totalCredited = allRows.reduce((s, r) => s + r.credited, 0);
  const totalBorrowed = allRows.reduce((s, r) => s + r.borrowed, 0);
  const finalBalance = totalCredited - totalBorrowed;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={COL_H}>Date</th>
          {showTypeCol && <th style={COL_H}>Type</th>}
          <th style={COL_H}>Description</th>
          <th style={{ ...COL_H, textAlign: "right" as const }}>Credited (+)</th>
          <th style={{ ...COL_H, textAlign: "right" as const }}>Borrowed (−)</th>
          <th style={{ ...COL_H, textAlign: "right" as const }}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const balColor = r.runningBalance < 0 ? "#991b1b" : "#1b4332";
          return (
            <tr key={`${r.date}-${i}`} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f8faf9" }}>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
              {showTypeCol && (
                <td style={{ padding: "9px 14px" }}>
                  {r.rowType === "work"
                    ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "#dcfce7", color: "#166534" }}>Wage</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "#fee2e2", color: "#991b1b" }}>Advance</span>
                  }
                </td>
              )}
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#374151" }}>
                {r.description}
                {r.numWorkersOrHours && <span style={{ display: "block", fontSize: 11, color: "#9ca3af", textTransform: "capitalize" }}>{r.numWorkersOrHours}</span>}
              </td>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, textAlign: "right", color: "#166534" }}>
                {r.credited > 0 ? `+ ${formatCurrency(r.credited)}` : "—"}
              </td>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, textAlign: "right", color: "#991b1b" }}>
                {r.borrowed > 0 ? `− ${formatCurrency(r.borrowed)}` : "—"}
              </td>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, textAlign: "right", color: balColor }}>
                {formatCurrency(Math.abs(r.runningBalance))}{r.runningBalance < 0 ? " (Dr)" : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ background: "#f0fdf4", borderTop: "2px solid #1b4332" }}>
          <td colSpan={showTypeCol ? 3 : 2} style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "#1b4332" }}>
            TOTALS ({allRows.length} records)
          </td>
          <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 800, color: "#166534", textAlign: "right" }}>{formatCurrency(totalCredited)}</td>
          <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 800, color: "#991b1b", textAlign: "right" }}>{formatCurrency(totalBorrowed)}</td>
          <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 800, textAlign: "right", color: finalBalance >= 0 ? "#1b4332" : "#991b1b" }}>
            {formatCurrency(Math.abs(finalBalance))}{finalBalance < 0 ? " (Dr)" : ""}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
