"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { supplierPortalLogout } from "@/lib/api";
import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";

export function PortalHeader() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  function current(href: string): "page" | undefined {
    return pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined;
  }

  async function logout() {
    const token = getSupplierPortalToken();

    clearSupplierPortalToken();

    if (token) {
      await supplierPortalLogout(token).catch(() => undefined);
    }

    router.replace("/supplier-portal/login");
  }

  return (
    <header className="supplier-portal-header">
      <div className="supplier-portal-brand">
        <ShieldCheck size={25} />

        <div>
          <span>ProcureIQ</span>

          <strong>Supplier Portal</strong>
        </div>
      </div>

      <div className="supplier-portal-header-actions">
        <Link href="/supplier-portal/home" aria-current={current("/supplier-portal/home")}>
          Home
        </Link>

        <Link href="/supplier-portal/rfqs" aria-current={current("/supplier-portal/rfqs")}>
          RFQs and quotations
        </Link>

        <Link
          href="/supplier-portal/purchase-orders"
          aria-current={current("/supplier-portal/purchase-orders")}
        >
          Purchase orders
        </Link>

        <Link
          href="/supplier-portal/documents"
          aria-current={current("/supplier-portal/documents")}
        >
          Compliance documents
        </Link>

        <button type="button" onClick={() => void logout()}>
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </header>
  );
}
