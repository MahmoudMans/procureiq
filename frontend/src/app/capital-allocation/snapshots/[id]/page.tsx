"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Camera,
  CircleAlert,
  Coins,
  Download,
  FileCheck2,
  Gauge,
  Info,
  RefreshCw,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  type MeterTone,
  Skeleton,
  StatusBadge,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getCapitalAllocationSnapshot } from "@/lib/api";
import type { CapitalAllocationSnapshotDetail } from "@/types/capital-allocation";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = CapitalAllocationSnapshotDetail["items"][number];

interface RankedItem {
  rank: number;
  item: SnapshotItem;
}

function amount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function money(value: number, currency: string): string {
  return `${amount(value)} ${currency}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Downloads rows as a CSV file. Text that could be read as a formula is neutralised. */
function downloadRows(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const cell = (value: string | number): string => {
    const text =
      typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : String(value);

    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const body = [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ProgressLine({
  pct,
  tone,
  caption,
  label,
}: {
  pct: number;
  tone: MeterTone;
  caption: string;
  label: string;
}) {
  return (
    <div className="kit-meter-wrap">
      <Meter value={clampPercent(pct)} max={100} tone={tone} ariaLabel={label} />

      <span className="kit-meter-caption">{caption}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(): Column<RankedItem>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      align: "right",
      width: 70,
      sortValue: (row) => row.rank,
      cell: (row) => row.rank,
    },
    {
      id: "candidate",
      header: "Candidate",
      sortValue: (row) => String(row.item.initiativeTitle).toLowerCase(),
      cell: (row) => (
        <div className="kit-cell-stack">
          <strong>{row.item.initiativeTitle}</strong>

          <small>{row.item.caseNumber}</small>
        </div>
      ),
    },
    {
      id: "request",
      header: "Request",
      align: "right",
      sortValue: (row) => row.item.requestedCapitalAmount,
      cell: (row) => amount(row.item.requestedCapitalAmount),
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (row) => row.item.priorityScore,
      cell: (row) => row.item.priorityScore.toFixed(1),
    },
    {
      id: "advisory",
      header: "Advisory",
      sortValue: (row) => String(row.item.recommendation),
      cell: (row) => (
        <StatusBadge
          value={String(row.item.recommendation)}
          label={readable(String(row.item.recommendation))}
        />
      ),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (row) => String(row.item.decision),
      cell: (row) => (
        <StatusBadge
          value={String(row.item.decision)}
          label={readable(String(row.item.decision))}
        />
      ),
    },
    {
      id: "roi",
      header: "ROI",
      align: "right",
      sortValue: (row) => row.item.roiPct,
      cell: (row) => (
        <span className={row.item.roiPct < 0 ? "kit-text-danger" : undefined}>
          {row.item.roiPct.toFixed(1)}%
        </span>
      ),
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (row) => row.item.persistencePct,
      cell: (row) => `${row.item.persistencePct.toFixed(1)}%`,
    },
    {
      id: "net",
      header: "Net value",
      align: "right",
      sortValue: (row) => row.item.netValueAmount,
      cell: (row) => (
        <strong className={row.item.netValueAmount < -0.005 ? "kit-text-danger" : undefined}>
          {amount(row.item.netValueAmount)}
        </strong>
      ),
    },
    {
      id: "rationale",
      header: "Rationale",
      sortValue: (row) => String(row.item.decisionNote ?? "").toLowerCase(),
      cell: (row) =>
        row.item.decisionNote ? (
          <span className="kit-clamp">{row.item.decisionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: CapitalAllocationSnapshotDetail;
}

export default function CapitalAllocationSnapshotPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [result, setResult] = useState<SnapshotData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getCapitalAllocationSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load allocation snapshot.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (detail === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/capital-allocation" className="request-back-link">
          <ArrowLeft size={16} />
          Capital allocation
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { snapshot, items } = detail;
  const currency = snapshot.currency;
  const hasItems = items.length > 0;
  const budget = snapshot.budgetAmount;

  const ranked: RankedItem[] = items.map((item, index) => ({ rank: index + 1, item }));
  const requestedTotal = items.reduce((sum, item) => sum + item.requestedCapitalAmount, 0);
  const negative = items.filter((item) => item.netValueAmount < -0.005);
  const positive = items.length - negative.length;
  const overBudget = snapshot.remainingBudgetAmount < -0.005;
  const requestedPct = budget > 0 ? (requestedTotal / budget) * 100 : 0;

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-allocation.csv`,
      [
        "Rank",
        "Candidate",
        "Case number",
        "Requested capital",
        "Priority score",
        "Advisory",
        "Decision",
        "ROI %",
        "Persistence %",
        "Net value",
        "Rationale",
        "Currency",
      ],
      ranked.map((row) => [
        row.rank,
        String(row.item.initiativeTitle),
        String(row.item.caseNumber),
        row.item.requestedCapitalAmount,
        row.item.priorityScore,
        readable(String(row.item.recommendation)),
        readable(String(row.item.decision)),
        row.item.roiPct,
        row.item.persistencePct,
        row.item.netValueAmount,
        String(row.item.decisionNote ?? ""),
        currency,
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "candidate", "candidates"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Budget",
      icon: Banknote,
      value: money(budget, currency),
      note: "Governed cycle budget",
    },
    {
      label: "Funded",
      icon: Coins,
      value: money(snapshot.fundedAmount, currency),
      note: "Committed by the committee",
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(snapshot.remainingBudgetAmount, currency),
      note: overBudget ? "Over budget" : "Left to allocate",
      tone: overBudget ? "warning" : "default",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${snapshot.budgetUtilizationPct.toFixed(1)}%`,
      note: "Funded against budget",
    },
    {
      label: "Funded net value",
      icon: TrendingUp,
      value: money(snapshot.fundedNetValueAmount, currency),
      note: "Net value of funded candidates",
    },
    {
      label: "Opportunity cost",
      icon: Scale,
      value: money(snapshot.opportunityCostAmount, currency),
      note: "Proxy for value not funded",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/capital-allocation" className="request-back-link">
        <ArrowLeft size={16} />
        Capital allocation
      </Link>

      <section className="allocation-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable investment-committee snapshot</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.cycleNumber}
            {" · "}
            {snapshot.cycleTitle}
            {" · "}
            {currency}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportItems}
            disabled={!hasItems}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {overBudget ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              Funding exceeded the budget by{" "}
              {money(Math.abs(snapshot.remainingBudgetAmount), currency)}.
            </strong>{" "}
            {money(snapshot.fundedAmount, currency)} was funded against a budget of{" "}
            {money(budget, currency)}.
          </div>
        </div>
      ) : null}

      {budget > 0 && requestedTotal > budget + 0.005 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              Candidates requested {money(requestedTotal, currency)} against a budget of{" "}
              {money(budget, currency)}.
            </strong>{" "}
            Not every request could be funded.
          </div>
        </div>
      ) : null}

      {negative.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(negative.length, "candidate had", "candidates had")} negative net value at
              capture.
            </strong>{" "}
            The Net value column shows them in red.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no candidates.</strong> There were no investment
            decisions when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Allocation snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Budget at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          {budget > 0 ? (
            <ProgressLine
              pct={snapshot.budgetUtilizationPct}
              tone="primary"
              caption={`${money(snapshot.fundedAmount, currency)} funded of ${money(budget, currency)} budget (${snapshot.budgetUtilizationPct.toFixed(1)}%)`}
              label="Funded against budget"
            />
          ) : null}

          {budget > 0 ? (
            <ProgressLine
              pct={requestedPct}
              tone="primary"
              caption={`${money(requestedTotal, currency)} requested against budget (${requestedPct.toFixed(1)}%)`}
              label="Requested capital against budget"
            />
          ) : null}

          <ProgressLine
            pct={(positive / items.length) * 100}
            tone={positive === items.length ? meterToneFor("success") : "primary"}
            caption={`${positive} of ${plural(items.length, "candidate", "candidates")} had positive net value`}
            label="Candidates with positive net value"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen committee portfolio</span>

            <h2>Investment decisions at capture time</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            In committee rank order, across {plural(items.length, "candidate", "candidates")}.
            Amounts are in {currency}.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={ranked}
          getRowId={(row) => String(row.item.allocationItemId)}
          ariaLabel="Frozen committee portfolio"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No candidates captured"
              description="This snapshot has no investment candidates."
            />
          }
        />
      </section>

      <section className="allocation-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable investment-committee evidence</strong>

          <p>
            This snapshot freezes the governed budget, ranking, recommendations, explicit
            committee decisions and opportunity-cost proxy as they existed at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
