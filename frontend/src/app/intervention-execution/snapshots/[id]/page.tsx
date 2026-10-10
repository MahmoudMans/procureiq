"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Info,
  Layers,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Wrench,
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
import { getInterventionExecutionSnapshot } from "@/lib/api";
import type { InterventionExecutionSnapshotDetail } from "@/types/intervention-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = InterventionExecutionSnapshotDetail["items"][number];

function money(value: number, currency?: string | null): string {
  const text = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${text} ${currency}` : text;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function hasVariance(item: SnapshotItem): boolean {
  return Math.abs(item.implementationVarianceAmount) > 0.005;
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
      sortValue: (item) => String(item.initiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.initiativeTitle}</strong>

          <small>{item.executionNumber}</small>
        </div>
      ),
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
      sortValue: (item) => String(item.executionHealth),
      cell: (item) => (
        <StatusBadge
          value={String(item.executionHealth)}
          label={readable(String(item.executionHealth))}
        />
      ),
    },
    {
      id: "action",
      header: "Action",
      sortValue: (item) => String(item.approvedAction),
      cell: (item) => (
        <StatusBadge
          value={String(item.approvedAction)}
          label={readable(String(item.approvedAction))}
        />
      ),
    },
    {
      id: "approved",
      header: "Approved",
      align: "right",
      sortValue: (item) => item.approvedAffectedCapitalAmount,
      cell: (item) => money(item.approvedAffectedCapitalAmount, item.currency),
    },
    {
      id: "implemented",
      header: "Implemented",
      align: "right",
      sortValue: (item) => item.implementedCapitalAmount,
      cell: (item) => <strong>{money(item.implementedCapitalAmount, item.currency)}</strong>,
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingImplementationAmount,
      cell: (item) => money(item.remainingImplementationAmount, item.currency),
    },
    {
      id: "pct",
      header: "Completion",
      align: "right",
      sortValue: (item) => item.implementationPct,
      cell: (item) => <strong>{item.implementationPct.toFixed(1)}%</strong>,
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.implementationVarianceAmount,
      cell: (item) => (
        <span className={hasVariance(item) ? "kit-text-warning" : undefined}>
          {money(item.implementationVarianceAmount, item.currency)}
        </span>
      ),
    },
    {
      id: "released",
      header: "Current released",
      align: "right",
      sortValue: (item) => item.currentReleasedCapitalAmount,
      cell: (item) => money(item.currentReleasedCapitalAmount, item.currency),
    },
    {
      id: "currentRemaining",
      header: "Current remaining",
      align: "right",
      sortValue: (item) => item.currentRemainingCommitmentAmount,
      cell: (item) => money(item.currentRemainingCommitmentAmount, item.currency),
    },
    {
      id: "target",
      header: "Target",
      sortValue: (item) => String(item.approvedTargetValueCaseNumber ?? ""),
      cell: (item) =>
        item.approvedTargetValueCaseNumber ? (
          item.approvedTargetValueCaseNumber
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link
          href={`/intervention-execution/${encodeURIComponent(String(item.executionCaseId))}`}
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
  detail: InterventionExecutionSnapshotDetail;
}

export default function InterventionExecutionSnapshotPage() {
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
        const response = await getInterventionExecutionSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load execution snapshot.",
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
        <Link href="/intervention-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Intervention execution
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
  const cases = snapshot.caseCount;
  const remediation = snapshot.remediationCaseCount;
  const verified = snapshot.verifiedCaseCount;

  const withVariance = items.filter(hasVariance);
  const incomplete = items.filter((item) => item.remainingImplementationAmount > 0.005);
  const verifiedPct = cases > 0 ? (verified / cases) * 100 : 0;
  const outsideRemediation = Math.max(0, cases - remediation);

  const orderedItems = [...items].sort((a, b) => a.implementationPct - b.implementationPct);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-execution.csv`,
      [
        "Case",
        "Execution number",
        "Status",
        "Health",
        "Approved action",
        "Approved capital",
        "Implemented",
        "Remaining",
        "Completion %",
        "Variance",
        "Current released",
        "Current remaining",
        "Target value case",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.initiativeTitle),
        String(item.executionNumber),
        readable(String(item.caseStatus)),
        readable(String(item.executionHealth)),
        readable(String(item.approvedAction)),
        item.approvedAffectedCapitalAmount,
        item.implementedCapitalAmount,
        item.remainingImplementationAmount,
        item.implementationPct,
        item.implementationVarianceAmount,
        item.currentReleasedCapitalAmount,
        item.currentRemainingCommitmentAmount,
        String(item.approvedTargetValueCaseNumber ?? ""),
        String(item.currency ?? ""),
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "case", "cases"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Cases",
      icon: Layers,
      value: String(cases),
      note: "Execution cases captured",
    },
    {
      label: "Ready",
      icon: ListChecks,
      value: String(snapshot.readyCaseCount),
      note: "Cases marked ready",
    },
    {
      label: "Verified",
      icon: ShieldCheck,
      value: String(verified),
      note: "Cases verified",
    },
    {
      label: "Remediation",
      icon: Wrench,
      value: String(remediation),
      note: "Cases in remediation",
      tone: remediation > 0 ? "warning" : "default",
    },
    {
      label: "Implemented",
      icon: Coins,
      value: money(snapshot.totalImplementedCapitalAmount),
      note: "Summed across cases",
    },
    {
      label: "Average completion",
      icon: Gauge,
      value: `${snapshot.averageImplementationPct.toFixed(1)}%`,
      note: "Implemented against approved",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/intervention-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Intervention execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable implementation portfolio</span>

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

      {remediation > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{plural(remediation, "case was", "cases were")} in remediation.</strong> Open
            case shows the live record for each, which may have moved on since capture.
          </div>
        </div>
      ) : null}

      {withVariance.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(withVariance.length, "case carried", "cases carried")} an implementation
              variance.
            </strong>{" "}
            The Variance column shows {withVariance.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {incomplete.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(incomplete.length, "case still had", "cases still had")} implementation
              remaining.
            </strong>{" "}
            Average completion was {snapshot.averageImplementationPct.toFixed(1)}% at capture.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no cases.</strong> There was no implementation
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Intervention execution snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Implementation at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.averageImplementationPct}
            tone={snapshot.averageImplementationPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average completion ${snapshot.averageImplementationPct.toFixed(1)}% of approved capital implemented`}
            label="Average implementation completion"
          />

          {cases > 0 ? (
            <ProgressLine
              pct={verifiedPct}
              tone={verifiedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${verified} of ${plural(cases, "case", "cases")} verified`}
              label="Verified cases"
            />
          ) : null}

          {cases > 0 ? (
            <ProgressLine
              pct={(outsideRemediation / cases) * 100}
              tone={remediation === 0 ? meterToneFor("success") : "primary"}
              caption={`${outsideRemediation} of ${plural(cases, "case", "cases")} were outside remediation`}
              label="Cases outside remediation"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen implementation state</span>

            <h2>Approved vs implemented</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Lowest completion first, across {plural(items.length, "case", "cases")}. Amounts show
            the currency of each case. Open case shows the live record, which may have changed
            since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.executionCaseId)}
          ariaLabel="Frozen implementation cases"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No cases captured"
              description="This snapshot has no implementation cases."
            />
          }
        />
      </section>

      <section className="execution-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable execution reconciliation evidence</strong>

          <p>
            This snapshot freezes approved intervention amounts, documented implementation,
            variance and current source funding state without changing any Step 57–60 historical
            authority.
          </p>
        </div>
      </section>
    </div>
  );
}
