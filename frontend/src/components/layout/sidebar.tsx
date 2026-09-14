"use client";

import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  PackageCheck,
  Settings,
  ShoppingCart,
} from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: Building2,
  },
  {
    href: "/purchase-requests",
    label: "Purchase requests",
    icon: ShoppingCart,
  },
  {
    href: "/rfqs",
    label: "RFQs & sourcing",
    icon: FileText,
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">

      <div className="sidebar__brand">

        <div className="sidebar__brand-mark">
          <PackageCheck
            size={22}
            strokeWidth={2.3}
          />
        </div>

        <div>
          <strong>ProcureIQ</strong>
          <span>
            Procurement intelligence
          </span>
        </div>

      </div>

      <div className="sidebar__section-label">
        Workspace
      </div>

      <nav className="sidebar__navigation">

        {navigation.map((item) => {
          const Icon = item.icon;

          const active =
            pathname === item.href ||
            (
              item.href !== "/" &&
              pathname.startsWith(
                `${item.href}/`,
              )
            );

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                `sidebar__link ${
                  active
                    ? "sidebar__link--active"
                    : ""
                }`
              }
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}

      </nav>

      <div className="sidebar__footer">

        <button
          className={
            "sidebar__link sidebar__link--button"
          }
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>

        <div className="workspace-card">

          <div className="workspace-card__avatar">
            PR
          </div>

          <div>
            <strong>
              Procurement Team
            </strong>
            <span>
              Enterprise workspace
            </span>
          </div>

        </div>

      </div>

    </aside>
  );
}
