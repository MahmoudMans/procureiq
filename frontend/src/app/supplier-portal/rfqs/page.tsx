"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "@/components/supplier-portal/portal-rfqs.css";
import { PortalHeader } from "@/components/supplier-portal/portal-header";
import {
  deadlineNote,
  formatDeadline,
  formatMoney,
  needsQuotation,
  quotationLabel,
  quotationTone,
  readable,
} from "@/components/supplier-portal/portal-rfq-format";
import { getSupplierPortalRfqs } from "@/lib/supplier-portal-rfqs";
import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";
import type { PortalRfqSummary } from "@/types/supplier-portal-rfq";

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

function RfqCard({ rfq, now }: { rfq: PortalRfqSummary; now: number | null }) {
  const declined = rfq.invitationStatus === "DECLINED";
  const note = rfq.open && !declined ? deadlineNote(rfq.responseDeadline, now) : null;
  const status = rfq.quotation?.status ?? null;

  return (
    <Link
      href={`/supplier-portal/rfqs/${rfq.id}`}
      className="supplier-portal-workspace-card portal-rfq-card"
    >
      <div className="supplier-portal-workspace-card-heading">
        <div>
          <strong>{rfq.title}</strong>

          <small>
            {rfq.rfqNumber}
            {" · "}
            {rfq.lineCount} {rfq.lineCount === 1 ? "line" : "lines"}
          </small>
        </div>

        <span
          className={`portal-rfq-pill portal-rfq-pill--${
            declined ? "warning" : rfq.open ? "success" : "neutral"
          }`}
        >
          {declined ? "Declined" : rfq.open ? "Open" : readable(rfq.rfqStatus)}
        </span>
      </div>

      <div className="supplier-portal-workspace-context">
        <span>Deadline {formatDeadline(rfq.responseDeadline)}</span>

        {note ? (
          <span className={`portal-rfq-note portal-rfq-note--${note.tone}`}>{note.text}</span>
        ) : null}
      </div>

      <div className="supplier-portal-workspace-context">
        {declined ? null : (
          <span className={`portal-rfq-pill portal-rfq-pill--${quotationTone(status)}`}>
            {quotationLabel(status)}
          </span>
        )}

        {rfq.quotation ? (
          <span>{formatMoney(rfq.quotation.totalAmount, rfq.currency)}</span>
        ) : null}
      </div>
    </Link>
  );
}

export default function SupplierPortalRfqsPage() {
  const router = useRouter();

  const [rfqs, setRfqs] = useState<PortalRfqSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    const timer = window.setTimeout(async () => {
      setFetching(true);

      try {
        const response = await getSupplierPortalRfqs(token);

        if (active) {
          setRfqs(response);
          setError(null);
        }
      } catch (caught) {
        if (!active) {
          return;
        }

        const message = caught instanceof Error ? caught.message : "Unable to load your RFQs.";

        if (/session/i.test(message)) {
          clearSupplierPortalToken();
          router.replace("/supplier-portal/login");

          return;
        }

        setError(message);
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
  }, [router, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [rfqs]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (rfqs === null && error === null) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">Loading RFQs...</div>
      </main>
    );
  }

  const all = rfqs ?? [];
  const open = all.filter((rfq) => rfq.open && rfq.invitationStatus !== "DECLINED");
  const past = all.filter((rfq) => !rfq.open || rfq.invitationStatus === "DECLINED");
  const toRespond = open.filter((rfq) => needsQuotation(rfq.quotation?.status ?? null));
  const submitted = open.filter((rfq) => rfq.quotation?.status === "SUBMITTED");

  const closingSoon =
    now === null
      ? 0
      : open.filter((rfq) => {
          const target = new Date(rfq.responseDeadline).getTime();

          return !Number.isNaN(target) && target > now && target - now <= FORTY_EIGHT_HOURS;
        }).length;

  return (
    <main className="supplier-portal-shell">
      <PortalHeader />

      <div className="supplier-portal-content">
        {error ? (
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {error}

            <button type="button" onClick={reload}>
              Try again
            </button>
          </div>
        ) : null}

        <section className="supplier-portal-welcome">
          <div>
            <span>Sourcing</span>

            <h1>RFQs and quotations</h1>

            <p>
              Requests for quotation you have been invited to. Prepare your prices, submit before
              the deadline, and withdraw to revise while the RFQ is open.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="button button--secondary"
              onClick={reload}
              disabled={fetching}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </section>

        <section className="supplier-portal-kpis">
          <article>
            <FileText size={19} />

            <div>
              <span>Open RFQs</span>

              <strong>{open.length}</strong>
            </div>
          </article>

          <article>
            <Clock3 size={19} />

            <div>
              <span>Need your quotation</span>

              <strong>{toRespond.length}</strong>
            </div>
          </article>

          <article>
            <CheckCircle2 size={19} />

            <div>
              <span>Submitted</span>

              <strong>{submitted.length}</strong>
            </div>
          </article>

          <article>
            <AlertTriangle size={19} />

            <div>
              <span>Closing within 48 hours</span>

              <strong>{closingSoon}</strong>
            </div>
          </article>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Respond now</span>

              <h2>Open for response</h2>
            </div>
          </div>

          {open.length === 0 ? (
            <p className="portal-rfq-empty">
              No RFQs are open for your response. When procurement invites you to an RFQ it will
              appear here.
            </p>
          ) : (
            <div className="supplier-portal-workspace-list">
              {open.map((rfq) => (
                <RfqCard key={rfq.id} rfq={rfq} now={now} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 ? (
          <section className="supplier-portal-panel">
            <div className="supplier-portal-panel-heading">
              <div>
                <span>History</span>

                <h2>Declined, closed and past RFQs</h2>
              </div>
            </div>

            <div className="supplier-portal-workspace-list">
              {past.map((rfq) => (
                <RfqCard key={rfq.id} rfq={rfq} now={now} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
