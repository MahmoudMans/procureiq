"use client";

/**
 * Sidebar
 * - 9 collapsible groups instead of one 90-item list (menu comes from navigation.ts).
 * - The group that contains the current page opens automatically.
 * - Open/closed state is remembered in localStorage.
 * - On small screens it becomes a slide-in drawer (controlled by AppShell).
 */
import { ChevronDown, LogOut, PackageCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  findGroupIdForPath,
  isActivePath,
  navigationGroups,
} from "@/components/layout/navigation";

const STORAGE_KEY = "procureiq.sidebar.groups";
const DEFAULT_OPEN_GROUPS = ["workspace"];

interface SidebarProps {
  /** Mobile drawer state (ignored on desktop). */
  open: boolean;
  /** Called after any navigation click so the mobile drawer can close. */
  onNavigate: () => void;
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

function readableRole(role: string): string {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readInitialGroups(pathname: string): string[] {
  let groups = DEFAULT_OPEN_GROUPS;

  try {
    const saved: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    );

    if (Array.isArray(saved)) {
      groups = saved.filter(
        (value): value is string => typeof value === "string",
      );
    }
  } catch {
    // Ignore unreadable storage and use the defaults.
  }

  const activeGroup = findGroupIdForPath(pathname);

  return activeGroup && !groups.includes(activeGroup)
    ? [...groups, activeGroup]
    : groups;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Safe lazy init: Sidebar only renders client-side, after the auth gate.
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    readInitialGroups(pathname),
  );

  // Navigating (palette, links elsewhere) always reveals the current group.
  // This is React's "adjust state while rendering" pattern: it only fires when
  // the pathname actually changed, so it settles after one extra render and
  // needs no effect.
  const [seenPathname, setSeenPathname] = useState(pathname);

  if (seenPathname !== pathname) {
    setSeenPathname(pathname);

    const activeGroup = findGroupIdForPath(pathname);

    if (activeGroup && !openGroups.includes(activeGroup)) {
      setOpenGroups([...openGroups, activeGroup]);
    }
  }

  function toggleGroup(id: string) {
    const next = openGroups.includes(id)
      ? openGroups.filter((groupId) => groupId !== id)
      : [...openGroups, id];

    setOpenGroups(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // State still works for this session.
    }
  }

  return (
    <aside
      className={`sidebar${open ? " sidebar--open" : ""}`}
      aria-label="Primary"
    >
      <Link href="/" className="sidebar__brand" onClick={onNavigate}>
        <div className="sidebar__brand-mark">
          <PackageCheck size={21} />
        </div>

        <div>
          <strong>ProcureIQ</strong>
          <span>Procurement Intelligence</span>
        </div>
      </Link>

      <nav className="nav-scroll" aria-label="Modules">
        {navigationGroups.map((group) => {
          const expanded = openGroups.includes(group.id);
          const GroupIcon = group.icon;
          const containsActive = group.items.some((item) =>
            isActivePath(pathname, item.href),
          );

          return (
            <section
              key={group.id}
              className={`nav-group${expanded ? " nav-group--open" : ""}${
                containsActive ? " nav-group--current" : ""
              }`}
            >
              <button
                type="button"
                className="nav-group__header"
                aria-expanded={expanded}
                aria-controls={`nav-group-${group.id}`}
                onClick={() => toggleGroup(group.id)}
              >
                <GroupIcon size={15} />

                <span className="nav-group__label">{group.label}</span>

                {containsActive && !expanded ? (
                  <i className="nav-group__dot" aria-hidden="true" />
                ) : null}

                <small className="nav-group__count">
                  {group.items.length}
                </small>

                <ChevronDown size={14} className="nav-group__chevron" />
              </button>

              {expanded ? (
                <div
                  className="nav-group__items"
                  id={`nav-group-${group.id}`}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item${
                          active ? " nav-item--active" : ""
                        }`}
                        aria-current={active ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <div className="nav-user">
          <div className="nav-user__avatar">
            {user ? initials(user.fullName) : "PI"}
          </div>

          <div className="nav-user__meta">
            <strong>{user?.fullName ?? "ProcureIQ"}</strong>
            <span>{user ? readableRole(user.role) : ""}</span>
          </div>

          <button
            type="button"
            className="nav-user__logout"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
