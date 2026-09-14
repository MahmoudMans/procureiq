"use client";

import {
  Bell,
  Search,
} from "lucide-react";

import type {
  ReactNode,
} from "react";

import {
  useEffect,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  Sidebar,
} from "@/components/layout/sidebar";

interface AppShellProps {
  children: ReactNode;
}

function initials(
  name: string,
): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      part => part[0],
    )
    .join("")
    .toUpperCase();
}

export function AppShell({
  children,
}: AppShellProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const {
    user,
    loading,
  } = useAuth();

  const loginRoute =
    pathname === "/login";

  useEffect(() => {
    if (
      !loginRoute &&
      !loading &&
      !user
    ) {
      router.replace(
        "/login",
      );
    }
  }, [
    loginRoute,
    loading,
    user,
    router,
  ]);

  if (loginRoute) {
    return <>{children}</>;
  }

  if (
    loading ||
    !user
  ) {
    return (
      <div
        className={
          "application-loading"
        }
      >
        <div
          className={
            "application-loading__mark"
          }
        >
          PI
        </div>

        <strong>
          ProcureIQ
        </strong>

        <span>
          Securing workspace...
        </span>
      </div>
    );
  }

  return (
    <div className="application-shell">

      <Sidebar />

      <div className="application-shell__content">

        <header className="topbar">

          <div className="topbar__search">

            <Search size={18} />

            <input
              type="text"
              aria-label="Global search"
              placeholder={
                "Search suppliers, RFQs, requests..."
              }
            />

            <span>⌘ K</span>

          </div>

          <div className="topbar__actions">

            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <span
                className={
                  "notification-dot"
                }
              />
            </button>

            <div className="user-chip">

              <div
                className={
                  "user-chip__avatar"
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
                    user
                      .departmentName
                  }
                </span>
              </div>

            </div>

          </div>

        </header>

        <main className="main-content">
          {children}
        </main>

      </div>

    </div>
  );
}
