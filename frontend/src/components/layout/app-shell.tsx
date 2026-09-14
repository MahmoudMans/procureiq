import {
  Bell,
  Search,
} from "lucide-react";

import type {
  ReactNode,
} from "react";

import {
  Sidebar,
} from "@/components/layout/sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({
  children,
}: AppShellProps) {

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
              <span className="notification-dot" />
            </button>

            <div className="user-chip">

              <div className="user-chip__avatar">
                MM
              </div>

              <div>
                <strong>
                  Procurement Manager
                </strong>
                <span>
                  Strategic sourcing
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
