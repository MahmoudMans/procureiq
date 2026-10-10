"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Hourglass,
  Info,
  Layers,
  RefreshCw,
  ShieldCheck,
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
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getCapitalRedeploymentSnapshot } from "@/lib/api";
import type { CapitalRedeploymentSnapshotDetail } from "@/types/capital-redeployment";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = CapitalRedeploymentSnapshotDetail["items"][number];

function amount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function money(value: number, currency?: string | null): string {
  const text = amount(value);

  return currency ? `${text} ${currency}` : text;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function hasVariance(item: SnapshotItem): boolean {
  return Math.abs(item.redeploymentVarianceAmount) > 0.005;
}

/** True when the source has less funding left than the case still has to release. */
function isFundingShort(item: SnapshotItem): boolean {
  return (
    item.remainingRedeploymentAmount > 0.005 &&
    item.currentSourceFundingRemainingAmount < item.remainingRedeploymentAmount - 0.005
  );
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

function buildItemColumns(): Column<SnapshotItem>[] {
  return [
    {
      id: "case",
      header: "Case",
      sortValue: (item) => String(item.redeploymentNumber).toLowerCase(),
      cell: (item) => <strong>{item.redeploymentNumber}</strong>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.caseStatus),
      cell: (item) => (
        <StatusBadge value={String(item.caseStatus)} label={readable(String(item.caseStatus))} />
      ),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.redeploymentHealth),
      cell: (item) => (
        <StatusBadge
          value={String(item.redeploymentHealth)}
          label={readable(String(item.redeploymentHealth))}
        />
      ),
    },
    {
      id: "target",
      header: "Target",
      sortValue: (item) => String(item.targetInitiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.targetInitiativeTitle}</strong>

          <small>{item.targetValueCaseNumber}</small>
        </div>
      ),
    },
    {
      id: "approved",
      header: "Approved",
      align: "right",
      sortValue: (item) => item.approvedRedeploymentAmount,
      cell: (item) => money(item.approvedRedeploymentAmount, item.currency),
    },
    {
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.releasedRedeploymentAmount,
      cell: (item) => money(item.releasedRedeploymentAmount, item.currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingRedeploymentAmount,
      cell: (item) => money(item.remainingRedeploymentAmount, item.currency),
    },
    {
      id: "pct",
      header: "Completion",
      align: "right",
      sortValue: (item) => item.redeploymentPct,
      cell: (item) => <strong>{item.redeploymentPct.toFixed(1)}%</strong>,
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.redeploymentVarianceAmount,
      cell: (item) => (
        <span className={hasVariance(item) ? "kit-text-warning" : undefined}>
          {money(item.redeploymentVarianceAmount, item.currency)}
        </span>
      ),
    },
    {
      id: "funding",
      header: "Source funding remaining",
      align: "right",
      sortValue: (item) => item.currentSourceFundingRemainingAmount,
      cell: (item) => (
        <span className={isFundingShort(item) ? "kit-text-warning" : undefined}>
          {money(item.currentSourceFundingRemainingAmount, item.currency)}
        </span>
      ),
    },
    {
      id: "gates",
      header: "Gates",
      align: "right",
      sortValue: (item) => item.gateCount - item.resolvedGateCount,
      cell: (item) => (
        <span className={item.resolvedGateCount < item.gateCount ? "kit-text-warning" : undefined}>
          {item.resolvedGateCount} / {item.gateCount}
        </span>
      ),
    },
    {
      id: "authorizations",
      header: "Authorizations",
      align: "right",
      sortValue: (item) => item.authorizationCount,
      cell: (item) => item.authorizationCount,
    },
    {
      id: "releases",
      header: "Releases",
      align: "right",
      sortValue: (item) => item.releaseCount,
      cell: (item) => item.releaseCount,
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link
          href={`/capital-redeployment/${encodeURIComponent(String(item.redeploymentCaseId))}`}
          className="table-action"
        >
          Open case
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: CapitalRedeploymentSnapshotDetail;
}

export default function CapitalRedeploymentSnapshotPage() {
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
        const response = await getCapitalRedeploymentSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load redeployment snapshot.",
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
        <Link href="/capital-redeployment" className="request-back-link">
          <ArrowLeft size={16} />
          Capital redeployment
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
  const hasItems = items.length > 0;
  const totalCases = snapshot.caseCount;
  const pendingAuth = snapshot.authorizationPendingCaseCount;

  const unresolvedGates = items.filter((item) => item.resolvedGateCount < item.gateCount);
  const gateTotal = items.reduce((sum, item) => sum + item.gateCount, 0);
  const gateResolved = items.reduce((sum, item) => sum + item.resolvedGateCount, 0);
  const withVariance = items.filter(hasVariance);
  const fundingShort = items.filter(isFundingShort);
  const verifiedPct = totalCases > 0 ? (snapshot.verifiedCaseCount / totalCases) * 100 : 0;

  const orderedItems = [...items].sort((a, b) => a.redeploymentPct - b.redeploymentPct);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-redeployment.csv`,
      [
        "Case",
        "Status",
        "Health",
        "Target initiative",
        "Target value case",
        "Approved",
        "Released",
        "Remaining",
        "Completion %",
        "Variance",
        "Source funding remaining",
        "Resolved gates",
        "Total gates",
        "Authorizations",
        "Releases",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.redeploymentNumber),
        readable(String(item.caseStatus)),
        readable(String(item.redeploymentHealth)),
        String(item.targetInitiativeTitle),
        String(item.targetValueCaseNumber),
        item.approvedRedeploymentAmount,
        item.releasedRedeploymentAmount,
        item.remainingRedeploymentAmount,
        item.redeploymentPct,
        item.redeploymentVarianceAmount,
        item.currentSourceFundingRemainingAmount,
        item.resolvedGateCount,
        item.gateCount,
        item.authorizationCount,
        item.releaseCount,
        String(item.currency ?? ""),
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "case", "cases"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Cases",
      icon: Layers,
      value: String(totalCases),
      note: "Redeployment cases captured",
    },
    {
      label: "Authorization queue",
      icon: Hourglass,
      value: String(pendingAuth),
      note: "Cases awaiting authorization",
      tone: pendingAuth > 0 ? "warning" : "default",
    },
    {
      label: "Active",
      icon: Activity,
      value: String(snapshot.activeCaseCount),
      note: "Cases currently active",
    },
    {
      label: "Verified",
      icon: ShieldCheck,
      value: String(snapshot.verifiedCaseCount),
      note: "Cases verified",
    },
    {
      label: "Released",
      icon: Coins,
      value: amount(snapshot.totalReleasedRedeploymentAmount),
      note: "Summed across cases",
    },
    {
      label: "Average completion",
      icon: Gauge,
      value: `${snapshot.averageRedeploymentPct.toFixed(1)}%`,
      note: "Released against approved",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/capital-redeployment" className="request-back-link">
        <ArrowLeft size={16} />
        Capital redeployment
      </Link>

      <section className="redeployment-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable redeployment portfolio</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            Captured by {snapshot.capturedByName ?? "Procurement management"}
            {snapshot.capturedAt ? ` · ${formatDateTime(snapshot.capturedAt)}` : ""}
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

      {pendingAuth > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(pendingAuth, "case was", "cases were")} waiting for authorization.
            </strong>{" "}
            Their redeployment had not been authorized when the snapshot was captured.
          </div>
        </div>
      ) : null}

      {unresolvedGates.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(unresolvedGates.length, "case had", "cases had")} unresolved gates.
            </strong>{" "}
            {gateResolved} of {plural(gateTotal, "gate was", "gates were")} resolved across the
            portfolio. The Gates column shows them in amber.
          </div>
        </div>
      ) : null}

      {fundingShort.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(fundingShort.length, "case had", "cases had")} less source funding remaining
              than redeployment still to release.
            </strong>{" "}
            The Source funding remaining column shows them in amber.
          </div>
        </div>
      ) : null}

      {withVariance.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(withVariance.length, "case carried", "cases carried")} a redeployment
              variance.
            </strong>{" "}
            The Variance column shows them in amber.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no cases.</strong> There was no redeployment portfolio
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capital redeployment snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Redeployment at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.averageRedeploymentPct}
            tone={snapshot.averageRedeploymentPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average completion ${snapshot.averageRedeploymentPct.toFixed(1)}% of approved capital released`}
            label="Average redeployment completion"
          />

          {gateTotal > 0 ? (
            <ProgressLine
              pct={(gateResolved / gateTotal) * 100}
              tone={gateResolved === gateTotal ? meterToneFor("success") : "primary"}
              caption={`${gateResolved} of ${plural(gateTotal, "gate", "gates")} resolved`}
              label="Gates resolved"
            />
          ) : null}

          {totalCases > 0 ? (
            <ProgressLine
              pct={verifiedPct}
              tone={verifiedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${snapshot.verifiedCaseCount} of ${plural(totalCases, "case", "cases")} verified`}
              label="Verified cases"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen redeployment state</span>

            <h2>Approved vs released capital</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Lowest completion first, across {plural(items.length, "case", "cases")}. Amounts show
            each case&apos;s own currency. Open case shows the live record, which may have changed
            since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.redeploymentCaseId)}
          ariaLabel="Frozen redeployment cases"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No cases captured"
              description="This snapshot has no redeployment cases."
            />
          }
        />
      </section>

      <section className="redeployment-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable redeployment evidence</strong>

          <p>
            This snapshot freezes approved recycled capital, actual redeployment, remaining
            authority, release controls and source-capital safety context without mutating Steps
            56–62.
          </p>
        </div>
      </section>
    </div>
  );
}
