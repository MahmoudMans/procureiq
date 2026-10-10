"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Camera,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Info,
  ListChecks,
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
import { getFundingSnapshot } from "@/lib/api";
import type { FundingSnapshotDetail } from "@/types/funding-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FundingSnapshotDetail["items"][number];

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

function buildItemColumns(): Column<SnapshotItem>[] {
  return [
    {
      id: "sequence",
      header: "#",
      align: "right",
      width: 60,
      sortValue: (item) => item.sequenceNo,
      cell: (item) => item.sequenceNo,
    },
    {
      id: "tranche",
      header: "Tranche",
      sortValue: (item) => String(item.title).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.title}</strong>

          <small>{item.trancheNumber}</small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.status),
      cell: (item) => (
        <StatusBadge value={String(item.status)} label={readable(String(item.status))} />
      ),
    },
    {
      id: "planned",
      header: "Planned",
      align: "right",
      sortValue: (item) => item.plannedReleaseAmount,
      cell: (item) => amount(item.plannedReleaseAmount),
    },
    {
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.releasedAmount,
      cell: (item) => (
        <strong
          className={
            item.releasedAmount > item.plannedReleaseAmount + 0.005 ? "kit-text-warning" : undefined
          }
        >
          {amount(item.releasedAmount)}
        </strong>
      ),
    },
    {
      id: "gates",
      header: "Gates resolved",
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
      cell: (item) => (
        <span
          className={
            item.releasedAmount > 0.005 && item.authorizationCount === 0
              ? "kit-text-warning"
              : undefined
          }
        >
          {item.authorizationCount}
        </span>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: FundingSnapshotDetail;
}

export default function FundingSnapshotPage() {
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
        const response = await getFundingSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load funding snapshot.");
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
        <Link href="/funding-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Funding execution
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

  const authorized = snapshot.authorizedCapitalAmount;
  const committed = snapshot.committedCapitalAmount;
  const planned = snapshot.plannedReleaseAmount;
  const released = snapshot.releasedAmount;
  const remaining = snapshot.remainingCommitmentAmount;

  const overCommitted = committed > authorized + 0.005;
  const overPlanned = planned > committed + 0.005;
  const overReleased = remaining < -0.005;

  const unresolved = items.filter((item) => item.resolvedGateCount < item.gateCount);
  const gateTotal = items.reduce((sum, item) => sum + item.gateCount, 0);
  const gateResolved = items.reduce((sum, item) => sum + item.resolvedGateCount, 0);
  const releasedOverPlan = items.filter(
    (item) => item.releasedAmount > item.plannedReleaseAmount + 0.005,
  );
  const noAuthorization = items.filter(
    (item) => item.releasedAmount > 0.005 && item.authorizationCount === 0,
  );

  const orderedItems = [...items].sort((a, b) => a.sequenceNo - b.sequenceNo);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-tranches.csv`,
      [
        "Sequence",
        "Tranche",
        "Tranche number",
        "Status",
        "Planned",
        "Released",
        "Gates",
        "Resolved gates",
        "Authorizations",
        "Currency",
      ],
      orderedItems.map((item) => [
        item.sequenceNo,
        String(item.title),
        String(item.trancheNumber),
        readable(String(item.status)),
        item.plannedReleaseAmount,
        item.releasedAmount,
        item.gateCount,
        item.resolvedGateCount,
        item.authorizationCount,
        currency,
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "tranche", "tranches"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Authorized",
      icon: Banknote,
      value: money(authorized, currency),
      note: "Authorized capital ceiling",
    },
    {
      label: "Committed",
      icon: Coins,
      value: money(committed, currency),
      note: overCommitted ? "Above authorized capital" : "Commitment at capture",
      tone: overCommitted ? "warning" : "default",
    },
    {
      label: "Planned",
      icon: ListChecks,
      value: money(planned, currency),
      note: overPlanned ? "Above the commitment" : "Planned across tranches",
      tone: overPlanned ? "warning" : "default",
    },
    {
      label: "Released",
      icon: TrendingUp,
      value: money(released, currency),
      note: "Released to date",
    },
    {
      label: "Release %",
      icon: Gauge,
      value: `${snapshot.releasePct.toFixed(1)}%`,
      note: "Release progress at capture",
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(remaining, currency),
      note: overReleased ? "Released above the commitment" : "Commitment left to release",
      tone: overReleased ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/funding-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Funding execution
      </Link>

      <section className="funding-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable funding snapshot</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.commitmentNumber}
            {" · "}
            {snapshot.initiativeTitle}
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

      {overCommitted ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              The commitment exceeded authorized capital by{" "}
              {money(committed - authorized, currency)}.
            </strong>{" "}
            {money(committed, currency)} was committed against a ceiling of{" "}
            {money(authorized, currency)}.
          </div>
        </div>
      ) : null}

      {overReleased ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              Releases exceeded the commitment by {money(Math.abs(remaining), currency)}.
            </strong>{" "}
            {money(released, currency)} had been released against {money(committed, currency)}{" "}
            committed.
          </div>
        </div>
      ) : null}

      {overPlanned ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              Planned releases exceeded the commitment by {money(planned - committed, currency)}.
            </strong>{" "}
            The tranche plan added up to {money(planned, currency)} against{" "}
            {money(committed, currency)} committed.
          </div>
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(unresolved.length, "tranche had", "tranches had")} unresolved gates.
            </strong>{" "}
            {gateResolved} of {plural(gateTotal, "gate was", "gates were")} resolved across the
            plan. The Gates resolved column shows them in amber.
          </div>
        </div>
      ) : null}

      {releasedOverPlan.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(releasedOverPlan.length, "tranche released", "tranches released")} more than
              planned.
            </strong>{" "}
            The Released column shows {releasedOverPlan.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {noAuthorization.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(noAuthorization.length, "tranche had", "tranches had")} releases but no
              recorded authorization.
            </strong>{" "}
            The Authorizations column shows {noAuthorization.length === 1 ? "it" : "them"} in
            amber.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no tranches.</strong> There was no release plan on the
            commitment when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Funding snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Funding at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          {planned > 0 ? (
            <ProgressLine
              pct={(released / planned) * 100}
              tone={released >= planned - 0.005 ? meterToneFor("success") : "primary"}
              caption={`${money(released, currency)} released of ${money(planned, currency)} planned (${((released / planned) * 100).toFixed(1)}%)`}
              label="Released against planned"
            />
          ) : null}

          {committed > 0 ? (
            <ProgressLine
              pct={(planned / committed) * 100}
              tone="primary"
              caption={`${money(planned, currency)} planned of ${money(committed, currency)} committed (${((planned / committed) * 100).toFixed(1)}%)`}
              label="Planned against committed"
            />
          ) : null}

          {authorized > 0 ? (
            <ProgressLine
              pct={(committed / authorized) * 100}
              tone="primary"
              caption={`${money(committed, currency)} committed of ${money(authorized, currency)} authorized (${((committed / authorized) * 100).toFixed(1)}%)`}
              label="Committed against authorized"
            />
          ) : null}

          {gateTotal > 0 ? (
            <ProgressLine
              pct={(gateResolved / gateTotal) * 100}
              tone={gateResolved === gateTotal ? meterToneFor("success") : "primary"}
              caption={`${gateResolved} of ${plural(gateTotal, "gate", "gates")} resolved`}
              label="Gates resolved"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen release plan</span>

            <h2>Tranches at capture time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            In release sequence, across {plural(items.length, "tranche", "tranches")}. Amounts are
            in {currency}.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.trancheId)}
          ariaLabel="Frozen release tranches"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No tranches captured"
              description="This snapshot has no release tranches."
            />
          }
        />
      </section>

      <section className="funding-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable capital-execution evidence</strong>

          <p>
            This snapshot freezes capital ceilings, commitment, tranche state, gate resolution,
            authorization history and releases at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
