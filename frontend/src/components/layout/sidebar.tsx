"use client";

import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Settings,
  ShoppingCart,
  Users,
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

  const navigation = [
    ...coreNavigation,
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
