"use client";

import { Menu, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { UiProvider } from "@/components/kit";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isPublicRoute } from "@/lib/public-routes";

interface AppShellProps {
  children: ReactNode;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** "⌘ K" on Apple devices, "Ctrl K" elsewhere (only called after hydration). */
function shortcutLabel(): string {
  if (typeof navigator === "undefined") {
    return "Ctrl K";
  }

  return /mac|iphone|ipad/i.test(navigator.userAgent) ? "⌘ K" : "Ctrl K";
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Public routes (staff sign-in and the supplier portal) render bare: no staff
  // sign-in is required and no staff chrome is shown. The portal has its own session.
  const publicRoute = isPublicRoute(pathname);

  // Redirect unauthenticated staff visitors to /login.
  useEffect(() => {
    if (!publicRoute && !loading && !user) {
      router.replace("/login");
    }
  }, [publicRoute, loading, user, router]);

  // Global shortcuts: ⌘K / Ctrl+K toggles the palette, Esc closes the mobile menu.
  useEffect(() => {
    if (publicRoute || !user) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (event.key === "Escape") {
        setNavOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [publicRoute, user]);

  if (publicRoute) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="application-loading">
        <div className="application-loading__mark">PI</div>

        <strong>ProcureIQ</strong>

        <span>Securing workspace...</span>
      </div>
    );
  }

  return (
    <UiProvider>
      <div className="application-shell">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />

        {navOpen ? (
          <div
            className="sidebar-backdrop"
            role="presentation"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <div className="application-shell__content">
          <header className="topbar">
            <div className="topbar__lead">
              <button
                type="button"
                className="icon-button topbar__menu"
                aria-label="Open navigation"
                onClick={() => setNavOpen(true)}
              >
                <Menu size={19} />
              </button>

              <button
                type="button"
                className="topbar__search"
                aria-label="Open search and commands"
                aria-haspopup="dialog"
                onClick={() => setPaletteOpen(true)}
              >
                <Search size={17} />

                <small className="topbar__search-text">
                  Search modules, suppliers, requests...
                </small>

                <kbd className="kbd">{shortcutLabel()}</kbd>
              </button>
            </div>

            <div className="topbar__actions">
              <ThemeToggle />

              <NotificationBell />

              <div className="user-chip">
                <div className="user-chip__avatar">
                  {initials(user.fullName)}
                </div>

                <div>
                  <strong>{user.fullName}</strong>

                  <span>{user.departmentName}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="main-content">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>

      {paletteOpen ? (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      ) : null}
    </UiProvider>
  );
}
