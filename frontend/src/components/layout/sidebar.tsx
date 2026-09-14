"use client";

import {
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  PackageOpen,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  FileCheck2,
  ShieldAlert,
  WalletCards,
  CalendarRange,
  BadgeDollarSign,
  PanelsTopLeft,
  ShieldCheck,
  Route,
  Layers3,
  Handshake,
  ScrollText,
  ReceiptText,
} from "lucide-react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

const coreNavigation = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: Building2,
  },  {
    href: "/supplier-performance",
    label: "Supplier performance",
    icon: ClipboardCheck,
  },  {
    href: "/supplier-resilience",
    label: "Supplier resilience",
    icon: ShieldCheck,
  },
  {
    href: "/compliance",
    label: "Policy & compliance",
    icon: ShieldCheck,
  },  {
    href: "/guided-buying",
    label: "Guided buying",
    icon: Route,
  },  {
    href: "/demand-consolidation",
    label: "Demand consolidation",
    icon: Layers3,
  },



  {
    href: "/contracts",
    label: "Contracts & compliance",
    icon: FileCheck2,
  },  {
    href: "/commercial-governance",
    label: "Commercial governance",
    icon: ScrollText,
  },
  {
    href: "/risks",
    label: "Risk register",
    icon: ShieldAlert,
  },  {
    href: "/budgets",
    label: "Budget control",
    icon: WalletCards,
  },  {
    href: "/planning",
    label: "Procurement planning",
    icon: CalendarRange,
  },  {
    href: "/savings",
    label: "Savings & value",
    icon: BadgeDollarSign,
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
  },  {
    href: "/negotiations",
    label: "Negotiations",
    icon: Handshake,
  },

  {
    href: "/purchase-orders",
    label: "Purchase orders",
    icon: PackageOpen,
  },  {
    href: "/invoice-control",
    label: "Invoice control",
    icon: ReceiptText,
  },

  {
    href: "/deliveries",
    label: "Deliveries",
    icon: Truck,
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
  },
    {
    href: "/command-center",
    label: "Command center",
    icon: PanelsTopLeft,
  },
{
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileSpreadsheet,
  },
  {
    href: "/activity",
    label: "Activity & alerts",
    icon: Bell,
  },
];

function roleLabel(
  role: string,
): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";

    case "PROCUREMENT_MANAGER":
      return "Procurement Manager";

    case "BUYER":
      return "Buyer";

    case "REQUESTER":
      return "Requester";

    case "APPROVER":
      return "Approver";

    default:
      return role;
  }
}

function initials(
  fullName: string,
): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      part => part[0],
    )
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const pathname =
    usePathname();

  const {
    user,
    logout,
  } = useAuth();

  const canViewTeam =
    user?.role === "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  const canViewApprovals =
    user?.role === "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "APPROVER";

  const canViewSourcing =
    user?.role === "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  const canViewAnalytics =
    user?.role === "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER" ||
    user?.role ===
      "APPROVER";

  const navigation = [
    ...coreNavigation.filter(
      item => {
        if (
          item.href ===
            "/approvals"
        ) {
          return canViewApprovals;
        }

        if (
          item.href ===
            "/rfqs" ||
          item.href ===
            "/purchase-orders" ||
          item.href ===
            "/deliveries"
        ) {
          return canViewSourcing;
        }

        if (
          item.href ===
            "/analytics" ||
          item.href ===
            "/reports" ||
          item.href ===
            "/risks" ||
          item.href ===
            "/budgets"
          ||
          item.href ===
            "/planning"
          ||
          item.href ===
            "/savings"
          ||
          item.href ===
            "/command-center"
          ||
          item.href ===
            "/supplier-performance"
          ||
          item.href ===
            "/compliance"
          ||
          item.href ===
            "/demand-consolidation"
          ||
          item.href ===
            "/negotiations"
          ||
          item.href ===
            "/supplier-resilience"
          ||
          item.href ===
            "/commercial-governance"
          ||
          item.href ===
            "/invoice-control"
) {
          return canViewAnalytics;
        }

        return true;
      },
    ),

    ...(canViewTeam
      ? [
          {
            href: "/team",
            label: "Team & access",
            icon: Users,
          },
        ]
      : []),
  ];

  return (
    <aside className="sidebar">

      <div className="sidebar__brand">

        <div
          className={
            "sidebar__brand-mark"
          }
        >
          <PackageCheck
            size={22}
            strokeWidth={2.3}
          />
        </div>

        <div>
          <strong>
            ProcureIQ
          </strong>

          <span>
            Procurement intelligence
          </span>
        </div>

      </div>

      <div
        className={
          "sidebar__section-label"
        }
      >
        Workspace
      </div>

      <nav
        className={
          "sidebar__navigation"
        }
      >
        {navigation.map(
          item => {
            const Icon =
              item.icon;

            const active =
              pathname ===
                item.href ||
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

                <span>
                  {item.label}
                </span>
              </Link>
            );
          },
        )}
      </nav>

      <div
        className={
          "sidebar__footer"
        }
      >
        <button
          type="button"
          className={
            "sidebar__link sidebar__link--button"
          }
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>

        <button
          type="button"
          className={
            "sidebar__link sidebar__link--button sidebar__logout"
          }
          onClick={logout}
        >
          <LogOut size={19} />
          <span>Sign out</span>
        </button>

        {user ? (
          <div className="workspace-card">

            <div
              className={
                "workspace-card__avatar"
              }
            >
              {initials(
                user.fullName,
              )}
            </div>

            <div>
              <strong>
                {user.fullName}
              </strong>

              <span>
                {
                  roleLabel(
                    user.role,
                  )
                }
              </span>
            </div>

          </div>
        ) : null}
      </div>

    </aside>
  );
}
