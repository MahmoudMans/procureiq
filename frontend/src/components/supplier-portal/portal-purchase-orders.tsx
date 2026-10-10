"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import "@/components/supplier-portal/portal-purchase-orders.css";
import { awaitingResponse, formatPoDate } from "@/components/supplier-portal/portal-po-format";
import { formatMoney } from "@/components/supplier-portal/portal-rfq-format";
import { getSupplierPortalPurchaseOrders } from "@/lib/supplier-portal-purchase-orders";
import { getSupplierPortalToken } from "@/lib/supplier-portal-session";
import type { PortalPurchaseOrderSummary } from "@/types/supplier-portal-purchase-order";

const SHOWN = 5;

/**
 * Purchase orders issued to this supplier that it has not answered yet. Shows nothing when
 * there are none, so the home page stays quiet.
 */
export function PortalPurchaseOrders() {
  const [orders, setOrders] = useState<PortalPurchaseOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getSupplierPortalToken();

    if (!token) {
      return;
    }

    let active = true;

    getSupplierPortalPurchaseOrders(token)
      .then((response) => {
        if (active) {
          setOrders(response);
          setError(null);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load purchase orders.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="portal-po-error" role="status">
        <CircleAlert size={16} />
        Purchase orders are unavailable right now. ({error})
      </div>
    );
  }

  const waiting = (orders ?? []).filter(awaitingResponse);

  if (waiting.length === 0) {
    return null;
  }

  return (
    <section className="supplier-portal-panel">
      <div className="supplier-portal-panel-heading">
        <div>
          <span>Purchase orders</span>

          <h2>Awaiting your response</h2>
        </div>
      </div>

      <ul className="portal-po-awaiting">
        {waiting.slice(0, SHOWN).map((order) => (
          <li key={order.id}>
            <Link href={`/supplier-portal/purchase-orders/${order.id}`}>
              <span>
                <strong>{order.poNumber}</strong>

                <small>{`Delivery by ${formatPoDate(order.expectedDeliveryDate)}`}</small>
              </span>

              <span>{formatMoney(order.totalAmount, order.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="portal-po-more">
        <Link href="/supplier-portal/purchase-orders">View all purchase orders</Link>
      </p>
    </section>
  );
}
