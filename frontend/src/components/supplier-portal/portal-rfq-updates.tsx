"use client";

import { Ban, CircleAlert, Info, Lock, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import "@/components/supplier-portal/portal-rfq-updates.css";
import { getSupplierPortalToken } from "@/lib/supplier-portal-session";
import { getSupplierPortalRfqUpdates } from "@/lib/supplier-portal-updates";
import type { PortalRfqUpdate, PortalRfqUpdateKind } from "@/types/supplier-portal-update";

interface KindStyle {
  icon: LucideIcon;
  tone: "success" | "info" | "neutral" | "warning";
}

const KINDS: Record<PortalRfqUpdateKind, KindStyle> = {
  AWARDED_TO_YOU: { icon: Trophy, tone: "success" },
  DECISION_MADE: { icon: Info, tone: "info" },
  RFQ_CLOSED: { icon: Lock, tone: "neutral" },
  RFQ_CANCELLED: { icon: Ban, tone: "warning" },
};

function whenLabel(iso: string): string {
  const time = Date.parse(iso);

  if (Number.isNaN(time)) {
    return "";
  }

  return new Date(time).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/**
 * What happened to the RFQs this supplier was invited to: closed, cancelled, awarded to it,
 * or decided in someone else's favour. Shows nothing when there is nothing recent, and
 * never discloses who won or any prices.
 */
export function PortalRfqUpdates() {
  const [updates, setUpdates] = useState<PortalRfqUpdate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getSupplierPortalToken();

    if (!token) {
      return;
    }

    let active = true;

    getSupplierPortalRfqUpdates(token)
      .then((response) => {
        if (active) {
          setUpdates(response);
          setError(null);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load RFQ updates.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="portal-update-error" role="status">
        <CircleAlert size={16} />
        RFQ updates are unavailable right now. ({error})
      </div>
    );
  }

  if (updates === null || updates.length === 0) {
    return null;
  }

  return (
    <section className="supplier-portal-panel">
      <div className="supplier-portal-panel-heading">
        <div>
          <span>Recent updates</span>

          <h2>RFQ outcomes</h2>
        </div>
      </div>

      <ul className="portal-updates">
        {updates.map((update) => {
          const style = KINDS[update.kind] ?? KINDS.DECISION_MADE;
          const Icon = style.icon;

          return (
            <li key={update.rfqId}>
              <Link
                href={`/supplier-portal/rfqs/${update.rfqId}`}
                className={`portal-update portal-update--${style.tone}`}
              >
                <span className="portal-update__icon" aria-hidden="true">
                  <Icon size={17} />
                </span>

                <span className="portal-update__body">
                  <strong>{update.headline}</strong>

                  <span>{update.message}</span>
                </span>

                <span className="portal-update__when">{whenLabel(update.occurredAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
