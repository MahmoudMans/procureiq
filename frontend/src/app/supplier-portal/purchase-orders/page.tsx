"use client";

import { CircleAlert, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "@/components/supplier-portal/portal-rfqs.css";
import "@/components/supplier-portal/portal-purchase-orders.css";
import { PortalHeader } from "@/components/supplier-portal/portal-header";
import {
  awaitingResponse,
  formatPoDate,
  orderStateLabel,
  orderStateTone,
} from "@/components/supplier-portal/portal-po-format";
import { formatMoney } from "@/components/supplier-portal/portal-rfq-format";
import { getSupplierPortalPurchaseOrders } from "@/lib/supplier-portal-purchase-orders";
import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";
import type { PortalPurchaseOrderSummary } from "@/types/supplier-portal-purchase-order";

function OrderCard({ order }: { order: PortalPurchaseOrderSummary }) {
  return (
    <Link
      href={`/supplier-portal/purchase-orders/${order.id}`}
      className="supplier-portal-workspace-card portal-rfq-card"
    >
      <div className="supplier-portal-workspace-card-heading">
        <div>
          <strong>{order.poNumber}</strong>

          <small>{order.rfqNumber}</small>
        </div>

        <span className={`portal-rfq-pill portal-rfq-pill--${orderStateTone(order)}`}>
          {orderStateLabel(order)}
        </span>
      </div>

      <div className="supplier-portal-workspace-context">
        <span>{`Delivery by ${formatPoDate(order.expectedDeliveryDate)}`}</span>

        <span>{formatMoney(order.totalAmount, order.currency)}</span>
      </div>

      <div className="supplier-portal-workspace-context">
        <span>{`Issued ${formatPoDate(order.issuedAt)}`}</span>
      </div>
    </Link>
  );
}

export default function SupplierPortalPurchaseOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<PortalPurchaseOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
        const response = await getSupplierPortalPurchaseOrders(token);

        if (active) {
          setOrders(response);
          setError(null);
        }
      } catch (caught) {
        if (!active) {
          return;
        }

        const message =
          caught instanceof Error ? caught.message : "Unable to load your purchase orders.";

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

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (orders === null && error === null) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">Loading purchase orders...</div>
      </main>
    );
  }

  const all = orders ?? [];
  const waiting = all.filter(awaitingResponse);
  const rest = all.filter((order) => !awaitingResponse(order));

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
            <span>Orders</span>

            <h1>Purchase orders</h1>

            <p>
              Orders issued to you after an RFQ award. Acknowledge each one, or reject it and
              tell procurement why.
            </p>
          </div>

          <button
            type="button"
            className="button portal-po-secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Needs your answer</span>

              <h2>Awaiting your response</h2>
            </div>
          </div>

          {waiting.length === 0 ? (
            <p className="portal-rfq-empty">Nothing is waiting for your response.</p>
          ) : (
            <div className="portal-po-grid">
              {waiting.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>History</span>

              <h2>Other purchase orders</h2>
            </div>
          </div>

          {rest.length === 0 ? (
            <p className="portal-rfq-empty">No other purchase orders yet.</p>
          ) : (
            <div className="portal-po-grid">
              {rest.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
