"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CircleAlert,
  Clock3,
  ExternalLink,
  Gauge,
  Info,
  ListChecks,
  Medal,
  RefreshCw,
  TrendingDown,
  Trophy,
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
  formatDate,
  meterToneFor,
} from "@/components/kit";
import { getQuotationComparison, getRfq, getRfqQuotations } from "@/lib/api";
import type { Quotation, QuotationComparison } from "@/types/quotation";
import type { Rfq } from "@/types/rfq";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RankedQuotation = QuotationComparison["quotations"][number];
type RfqLine = Rfq["lineItems"][number];

function money(value: number, currency: string, whole = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(value);
}

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isExpired(validityDate: string | null | undefined, today: string): boolean {
  return Boolean(validityDate) && String(validityDate).slice(0, 10) < today;
}

function findQuoteLine(quotation: Quotation, line: RfqLine) {
  return quotation.lines.find((quoted) => quoted.rfqLineItemId === line.id);
}

/** Lowest unit price for a line, only when at least two suppliers quoted different prices. */
function bestUnitPrice(line: RfqLine, quotations: Quotation[]): number | null {
  const prices: number[] = [];

  for (const quotation of quotations) {
    const quoted = findQuoteLine(quotation, line);

    if (quoted) {
      prices.push(quoted.unitPrice);
    }
  }

  if (prices.length < 2) {
    return null;
  }

  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);

  return highest - lowest > 0.005 ? lowest : null;
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

function buildRankingColumns(
  currency: string,
  lowestTotal: number,
  fastestDays: number | null,
  leadVaries: boolean,
): Column<RankedQuotation>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      width: 90,
      sortValue: (item) => item.rank,
      cell: (item) =>
        item.lowestCost ? (
          <span className="kit-inline-icon">
            <Trophy size={15} />#{item.rank}
          </span>
        ) : (
          `#${item.rank}`
        ),
    },
    {
      id: "supplier",
      header: "Supplier",
      sortValue: (item) => String(item.supplierName).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.supplierName}</strong>

          <small>{item.quotationNumber}</small>
        </div>
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (item) => item.totalAmount,
      cell: (item) => <strong>{money(item.totalAmount, currency)}</strong>,
    },
    {
      id: "variance",
      header: "Against the lowest",
      align: "right",
      sortValue: (item) => item.varianceFromLowest,
      cell: (item) => {
        if (item.lowestCost) {
          return <StatusBadge value="ACHIEVED" label="Lowest cost" />;
        }

        const pct = lowestTotal > 0 ? (item.varianceFromLowest / lowestTotal) * 100 : 0;

        return (
          <div className="kit-cell-stack">
            <span>+{money(item.varianceFromLowest, currency)}</span>

            <small>{pct.toFixed(1)}% above</small>
          </div>
        );
      },
    },
    {
      id: "lead",
      header: "Lead time",
      align: "right",
      sortValue: (item) => item.leadTimeDays,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{item.leadTimeDays} days</span>

          {leadVaries && fastestDays !== null && item.leadTimeDays === fastestDays ? (
            <StatusBadge value="READY" label="Fastest" />
          ) : null}
        </div>
      ),
    },
  ];
}

function buildMatrixColumns(quotations: Quotation[], highlightBest: boolean): Column<RfqLine>[] {
  const base: Column<RfqLine>[] = [
    {
      id: "line",
      header: "RFQ line",
      sortValue: (line) => String(line.itemName).toLowerCase(),
      cell: (line) => (
        <div className="kit-cell-stack">
          <strong>{line.itemName}</strong>

          {line.category ? <small>{line.category}</small> : null}
        </div>
      ),
    },
    {
      id: "quantity",
      header: "Quantity",
      align: "right",
      sortValue: (line) => Number(line.quantity),
      cell: (line) => `${line.quantity} ${line.unit}`,
    },
  ];

  const perQuotation: Column<RfqLine>[] = quotations.map((quotation) => ({
    id: `quotation-${String(quotation.id)}`,
    header: quotation.supplierName,
    align: "right",
    sortValue: (line) => findQuoteLine(quotation, line)?.unitPrice ?? null,
    cell: (line) => {
      const quoted = findQuoteLine(quotation, line);

      if (!quoted) {
        return <span className="kit-text-muted">—</span>;
      }

      const best = highlightBest ? bestUnitPrice(line, quotations) : null;
      const isBest = best !== null && Math.abs(quoted.unitPrice - best) < 0.005;

      return (
        <div className="kit-cell-stack">
          <strong>{money(quotation.currency ? quoted.unitPrice : quoted.unitPrice, quotation.currency)}</strong>

          <small>{money(quoted.lineSubtotal, quotation.currency)} total</small>

          {isBest ? <StatusBadge value="ACHIEVED" label="Lowest" /> : null}
        </div>
      );
    },
  }));

  return [...base, ...perQuotation];
}

function buildTermsColumns(today: string): Column<Quotation>[] {
  return [
    {
      id: "supplier",
      header: "Supplier",
      sortValue: (item) => String(item.supplierName).toLowerCase(),
      cell: (item) => <strong>{item.supplierName}</strong>,
    },
    {
      id: "subtotal",
      header: "Subtotal",
      align: "right",
      sortValue: (item) => item.subtotal,
      cell: (item) => money(item.subtotal, item.currency),
    },
    {
      id: "discount",
      header: "Discount",
      align: "right",
      sortValue: (item) => item.discountAmount,
      cell: (item) => money(item.discountAmount, item.currency),
    },
    {
      id: "shipping",
      header: "Shipping",
      align: "right",
      sortValue: (item) => item.shippingAmount,
      cell: (item) => money(item.shippingAmount, item.currency),
    },
    {
      id: "tax",
      header: "Tax",
      align: "right",
      sortValue: (item) => item.taxAmount,
      cell: (item) => money(item.taxAmount, item.currency),
    },
    {
      id: "total",
      header: "Final total",
      align: "right",
      sortValue: (item) => item.totalAmount,
      cell: (item) => <strong>{money(item.totalAmount, item.currency)}</strong>,
    },
    {
      id: "lead",
      header: "Lead time",
      align: "right",
      sortValue: (item) => item.leadTimeDays,
      cell: (item) => `${item.leadTimeDays} days`,
    },
    {
      id: "payment",
      header: "Payment terms",
      sortValue: (item) => String(item.paymentTerms ?? "").toLowerCase(),
      cell: (item) =>
        item.paymentTerms ? item.paymentTerms : <span className="kit-text-muted">—</span>,
    },
    {
      id: "valid",
      header: "Valid until",
      sortValue: (item) => String(item.validityDate ?? ""),
      cell: (item) => {
        const expired = isExpired(item.validityDate, today);

        return (
          <span className={expired ? "kit-text-danger" : undefined}>
            {showDate(item.validityDate)}
            {expired ? " · expired" : ""}
          </span>
        );
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface CompareData {
  id: string;
  rfq: Rfq;
  quotations: Quotation[];
  comparison: QuotationComparison;
}

export default function QuotationComparisonPage() {
  const params = useParams<{ id: string }>();

  const [result, setResult] = useState<CompareData | null>(null);
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
        const [rfqResponse, quotationResponse, comparisonResponse] = await Promise.all([
          getRfq(id),
          getRfqQuotations(id),
          getQuotationComparison(id),
        ]);

        if (active) {
          setResult({
            id,
            rfq: rfqResponse,
            quotations: quotationResponse.filter((quotation) => quotation.status === "SUBMITTED"),
            comparison: comparisonResponse,
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to build quotation comparison.",
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

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (data === null) {
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
        <Link href={`/rfqs/${params.id}`} className="request-back-link">
          <ArrowLeft size={16} />
          RFQ
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

  const { rfq, quotations, comparison } = data;
  const currency = comparison.currency;
  const today = isoDate(0);

  const ranked = [...comparison.quotations].sort((a, b) => a.rank - b.rank);
  const sortedQuotations = [...quotations].sort((a, b) => a.totalAmount - b.totalAmount);
  const hasQuotes = ranked.length > 0;
  const lowest = ranked.find((item) => item.lowestCost) ?? null;
  const fastestDays = hasQuotes ? Math.min(...ranked.map((item) => item.leadTimeDays)) : null;
  const fastest =
    fastestDays !== null ? (ranked.find((item) => item.leadTimeDays === fastestDays) ?? null) : null;
  const leadVaries = fastestDays !== null && ranked.some((item) => item.leadTimeDays !== fastestDays);
  const lowestTotal = comparison.lowestTotalAmount;
  const highestTotal = comparison.highestTotalAmount;
  const savingsPct = highestTotal > 0 ? (comparison.potentialSavings / highestTotal) * 100 : 0;

  const incomplete = sortedQuotations.filter((quotation) =>
    rfq.lineItems.some((line) => !findQuoteLine(quotation, line)),
  );
  const expired = sortedQuotations.filter((quotation) => isExpired(quotation.validityDate, today));
  const mixedCurrency = new Set(sortedQuotations.map((quotation) => quotation.currency)).size > 1;
  const singleResponse = ranked.length === 1;
  const lowestNotFastest =
    lowest !== null && fastest !== null && lowest.leadTimeDays > fastest.leadTimeDays;

  const kpis: KpiItem[] = [
    {
      label: "Lowest quotation",
      icon: Trophy,
      value: hasQuotes ? money(lowestTotal, currency, true) : "—",
      note: lowest ? lowest.supplierName : "Lowest submitted offer",
    },
    {
      label: "Potential savings",
      icon: TrendingDown,
      value: hasQuotes ? money(comparison.potentialSavings, currency, true) : "—",
      note:
        hasQuotes && highestTotal > 0
          ? `${savingsPct.toFixed(1)}% below the highest offer`
          : "Highest less lowest offer",
    },
    {
      label: "Highest quotation",
      icon: Banknote,
      value: hasQuotes ? money(highestTotal, currency, true) : "—",
      note: "Highest submitted exposure",
    },
    {
      label: "Responses compared",
      icon: Medal,
      value: String(comparison.submittedQuotationCount),
      note: "Submitted supplier responses",
      tone: comparison.submittedQuotationCount < 2 ? "warning" : "default",
    },
    {
      label: "Fastest delivery",
      icon: Clock3,
      value: fastestDays !== null ? `${fastestDays} days` : "—",
      note: fastest ? fastest.supplierName : "Shortest lead time",
    },
    {
      label: "Incomplete quotations",
      icon: ListChecks,
      value: String(incomplete.length),
      note: "Missing one or more RFQ lines",
      tone: incomplete.length > 0 ? "warning" : "default",
    },
  ];

  const rankingColumns = buildRankingColumns(currency, lowestTotal, fastestDays, leadVaries);
  const matrixColumns = buildMatrixColumns(sortedQuotations, !mixedCurrency);
  const termsColumns = buildTermsColumns(today);

  return (
    <div className="page-stack">
      <Link href={`/rfqs/${rfq.id}`} className="request-back-link">
        <ArrowLeft size={16} />
        {rfq.rfqNumber}
      </Link>

      <section className="page-heading quotation-comparison-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{rfq.rfqNumber}</span>

            <span>{currency}</span>
          </div>

          <span className="eyebrow">Commercial intelligence</span>

          <h1>Quotation comparison</h1>

          <p>
            Compare submitted supplier pricing, delivery terms and commercial exposure for{" "}
            {rfq.title}.
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

          <Link href={`/rfqs/${rfq.id}`} className="button button--secondary">
            <ExternalLink size={15} />
            Open RFQ
          </Link>
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

      {!hasQuotes ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No quotation has been submitted yet.</strong> The comparison fills in as
            suppliers submit their responses.
          </div>
        </div>
      ) : null}

      {singleResponse ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Only one quotation has been submitted.</strong> There is nothing to compare it
            against yet, so the savings figures are zero.
          </div>
        </div>
      ) : null}

      {incomplete.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(incomplete.length, "quotation does", "quotations do")} not cover every RFQ
              line.
            </strong>{" "}
            {incomplete.map((quotation) => quotation.supplierName).join(", ")}. Their totals are
            not like-for-like with complete responses.
          </div>
        </div>
      ) : null}

      {expired.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(expired.length, "quotation is", "quotations are")} past its validity date.
            </strong>{" "}
            {expired.map((quotation) => quotation.supplierName).join(", ")}. Confirm the price is
            still held before relying on it.
          </div>
        </div>
      ) : null}

      {mixedCurrency ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The quotations are in more than one currency.</strong> The lowest unit price
            per line is not marked, because prices in different currencies cannot be ranked
            directly.
          </div>
        </div>
      ) : null}

      {lowestNotFastest && lowest !== null && fastest !== null ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The lowest quotation is not the fastest.</strong> {lowest.supplierName}{" "}
            delivers in {lowest.leadTimeDays} days. {fastest.supplierName} delivers{" "}
            {lowest.leadTimeDays - fastest.leadTimeDays} days sooner for{" "}
            {money(fastest.varianceFromLowest, currency)} more.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Comparison summary" />

      {hasQuotes && highestTotal > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Price position</span>

              <h2>Offers against the highest quotation</h2>
            </div>

            <Gauge size={19} />
          </div>

          {ranked.map((item) => {
            const above = lowestTotal > 0 ? (item.varianceFromLowest / lowestTotal) * 100 : 0;

            return (
              <ProgressLine
                key={String(item.quotationId)}
                pct={(item.totalAmount / highestTotal) * 100}
                tone={item.lowestCost ? meterToneFor("success") : "primary"}
                caption={`${item.supplierName} — ${money(item.totalAmount, currency)}${
                  item.lowestCost ? " · lowest cost" : ` · ${above.toFixed(1)}% above the lowest`
                }`}
                label={`${item.supplierName} total against the highest quotation`}
              />
            );
          })}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Ranking</span>

            <h2>Quotations by total cost</h2>
          </div>

          <Trophy size={19} />
        </div>

        <DataTable
          columns={rankingColumns}
          rows={ranked}
          getRowId={(item) => String(item.quotationId)}
          ariaLabel="Quotation ranking"
          busy={fetching}
          empty={
            <EmptyState
              icon={Trophy}
              title="No quotations to rank"
              description="No submitted quotation is available for this RFQ."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Line-level analysis</span>

            <h2>Unit-price comparison</h2>
          </div>

          <ListChecks size={19} />
        </div>

        {!mixedCurrency && sortedQuotations.length > 1 ? (
          <p className="kit-meta-line">
            The lowest unit price on each line is marked when suppliers quoted different prices.
          </p>
        ) : null}

        <DataTable
          columns={matrixColumns}
          rows={rfq.lineItems}
          getRowId={(line) => String(line.id ?? line.lineNumber)}
          ariaLabel="Unit-price comparison by RFQ line"
          busy={fetching}
          empty={
            <EmptyState
              icon={ListChecks}
              title="No RFQ lines"
              description="This RFQ has no line items to compare."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Commercial terms</span>

            <h2>Supplier conditions</h2>
          </div>

          <Banknote size={19} />
        </div>

        <DataTable
          columns={termsColumns}
          rows={sortedQuotations}
          getRowId={(quotation) => String(quotation.id)}
          ariaLabel="Supplier commercial terms"
          busy={fetching}
          empty={
            <EmptyState
              icon={Banknote}
              title="No supplier terms"
              description="No submitted quotation is available for this RFQ."
            />
          }
        />
      </section>
    </div>
  );
}
