"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Info,
  Layers,
  ListChecks,
  LockKeyhole,
  RefreshCw,
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
import { getFlywheelReleaseSnapshot } from "@/lib/api";
import type { FlywheelReleaseSnapshotDetail } from "@/types/flywheel-release";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FlywheelReleaseSnapshotDetail["items"][number];

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

function noteOf(item: SnapshotItem): string | null {
  const note = item.executionNote ?? item.cancellationNote;

  return note ? String(note) : null;
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
      id: "lineage",
      header: "Lineage",
      sortValue: (item) => String(item.rootTargetInitiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.rootTargetInitiativeTitle}</strong>

          <small>{item.lineageNumber}</small>
        </div>
      ),
    },
    {
      id: "authorized",
      header: "Authorized",
      align: "right",
      sortValue: (item) => item.mandateAuthorizedItemAmount,
      cell: (item) => amount(item.mandateAuthorizedItemAmount),
    },
    {
      id: "planned",
      header: "Planned",
      align: "right",
      sortValue: (item) => item.plannedReleaseAmount,
      cell: (item) => (
        <strong
          className={
            item.plannedReleaseAmount > item.mandateAuthorizedItemAmount + 0.005
              ? "kit-text-warning"
              : undefined
          }
        >
          {amount(item.plannedReleaseAmount)}
        </strong>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.releaseItemStatus),
      cell: (item) => (
        <StatusBadge
          value={String(item.releaseItemStatus)}
          label={readable(String(item.releaseItemStatus))}
        />
      ),
    },
    {
      id: "reference",
      header: "Reference",
      sortValue: (item) => String(item.executionReference ?? "").toLowerCase(),
      cell: (item) =>
        item.executionReference ? (
          item.executionReference
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "evidence",
      header: "Evidence",
      sortValue: (item) => (noteOf(item) ?? "").toLowerCase(),
      cell: (item) => {
        const note = noteOf(item);

        return note ? (
          <span className="kit-clamp" title={note}>
            {note}
          </span>
        ) : (
          <span className="kit-text-muted">—</span>
        );
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: FlywheelReleaseSnapshotDetail;
}

export default function FlywheelReleaseSnapshotPage() {
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
        const response = await getFlywheelReleaseSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load immutable release evidence.",
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
        <Link href="/flywheel-release" className="request-back-link">
          <ArrowLeft size={16} />
          Capital release
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

  const authority = snapshot.mandateAuthorizedAmount;
  const planned = snapshot.batchPlannedReleaseAmount;
  const released = snapshot.batchReleasedAmount;
  const cumulative = snapshot.cumulativeMandateReleasedAmount;
  const remaining = snapshot.remainingMandateAmount;

  const overAuthority = remaining < -0.005 || cumulative > authority + 0.005;
  const unreleased = planned - released;
  const aboveAuthorized = items.filter(
    (item) => item.plannedReleaseAmount > item.mandateAuthorizedItemAmount + 0.005,
  );
  const cancelled = items.filter((item) => Boolean(item.cancellationNote));
  const noReference = items.filter((item) => !item.executionReference && !item.cancellationNote);
  const withReference = items.filter((item) => Boolean(item.executionReference)).length;

  const orderedItems = [...items].sort((a, b) => b.plannedReleaseAmount - a.plannedReleaseAmount);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-release.csv`,
      [
        "Lineage",
        "Lineage number",
        "Authorized",
        "Planned",
        "Status",
        "Reference",
        "Execution note",
        "Cancellation note",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.rootTargetInitiativeTitle),
        String(item.lineageNumber),
        item.mandateAuthorizedItemAmount,
        item.plannedReleaseAmount,
        readable(String(item.releaseItemStatus)),
        String(item.executionReference ?? ""),
        String(item.executionNote ?? ""),
        String(item.cancellationNote ?? ""),
        currency,
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "item", "items"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Mandate authority",
      icon: Banknote,
      value: money(authority, currency),
      note: "Authorized by the mandate",
    },
    {
      label: "Batch planned",
      icon: ListChecks,
      value: money(planned, currency),
      note: "Planned for this release",
    },
    {
      label: "Batch released",
      icon: Coins,
      value: money(released, currency),
      note: unreleased > 0.005 ? `${money(unreleased, currency)} still to release` : "Batch fully released",
    },
    {
      label: "Cumulative released",
      icon: TrendingUp,
      value: money(cumulative, currency),
      note: "Across the mandate",
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(remaining, currency),
      note: overAuthority ? "Above mandate authority" : "Mandate authority left",
      tone: overAuthority ? "warning" : "default",
    },
    {
      label: "Items",
      icon: Layers,
      value: String(items.length),
      note: `${withReference} with an execution reference`,
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/flywheel-release/${encodeURIComponent(String(snapshot.releaseBatchId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Release batch
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.releaseStatus)}
              label={readable(String(snapshot.releaseStatus))}
            />
          </div>

          <span className="eyebrow">Immutable release evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.releaseNumber}
            {" · "}
            {currency}
            {" · FY "}
            {snapshot.fiscalYear}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div className="fwstrategy-heading-actions">
            <LockKeyhole size={18} />

            <span className="fwstrategy-status-chip">Immutable</span>
          </div>

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

      {overAuthority ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Cumulative releases exceeded the mandate authority.</strong>{" "}
            {money(cumulative, currency)} had been released against {money(authority, currency)}{" "}
            of authority.
          </div>
        </div>
      ) : null}

      {released > planned + 0.005 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              The batch released {money(released - planned, currency)} more than was planned.
            </strong>{" "}
            {money(released, currency)} was released against {money(planned, currency)} planned.
          </div>
        </div>
      ) : null}

      {aboveAuthorized.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(aboveAuthorized.length, "item planned", "items planned")} more than{" "}
              {aboveAuthorized.length === 1 ? "its" : "their"} authorized amount.
            </strong>{" "}
            The Planned column shows them in amber.
          </div>
        </div>
      ) : null}

      {unreleased > 0.005 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{money(unreleased, currency)} of the planned batch was not yet released.</strong>{" "}
            The release status was {readable(String(snapshot.releaseStatus))} at capture.
          </div>
        </div>
      ) : null}

      {cancelled.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(cancelled.length, "item carries", "items carry")} a cancellation note.
            </strong>{" "}
            The Evidence column shows the reason.
          </div>
        </div>
      ) : null}

      {noReference.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(noReference.length, "item had", "items had")} no execution reference.
            </strong>{" "}
            Nothing had been recorded against {noReference.length === 1 ? "it" : "them"} at
            capture.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no release items.</strong> There was nothing in the
            batch when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Flywheel release snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Release at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          {planned > 0 ? (
            <ProgressLine
              pct={(released / planned) * 100}
              tone={released >= planned - 0.005 ? meterToneFor("success") : "primary"}
              caption={`${money(released, currency)} released of ${money(planned, currency)} planned (${((released / planned) * 100).toFixed(1)}%)`}
              label="Batch released against planned"
            />
          ) : null}

          {authority > 0 ? (
            <ProgressLine
              pct={(cumulative / authority) * 100}
              tone="primary"
              caption={`${money(cumulative, currency)} released of ${money(authority, currency)} mandate authority (${((cumulative / authority) * 100).toFixed(1)}%)`}
              label="Cumulative released against mandate authority"
            />
          ) : null}

          <ProgressLine
            pct={(withReference / items.length) * 100}
            tone={withReference === items.length ? meterToneFor("success") : "primary"}
            caption={`${withReference} of ${plural(items.length, "item", "items")} had an execution reference`}
            label="Items with an execution reference"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen execution evidence</span>

            <h2>Snapshot items</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Largest planned release first, across {plural(items.length, "item", "items")}. Amounts
            are in {currency}.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.allocationItemId)}
          ariaLabel="Frozen release items"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No release items"
              description="Snapshot contains no release items."
            />
          }
        />
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole size={18} />

        <div>
          <strong>Execution evidence is append-only</strong>

          <p>
            Release snapshots preserve the recorded Step 69 execution state and are protected
            against UPDATE and DELETE operations at the database layer.
          </p>
        </div>
      </section>
    </div>
  );
}
