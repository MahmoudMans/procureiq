"use client";

/**
 * NotificationBell
 *
 * Replaces the static bell icon with the real thing:
 *   - unread badge (polled every 60 s and when the tab becomes visible again)
 *   - dropdown with the latest notifications
 *   - click a notification -> marks it read and opens its page
 *   - "Mark all read" and a link to the full activity feed
 *
 * Roles without access to notifications (403) simply see no badge.
 */
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import type { ProcurementNotification } from "@/types/activity";

import "./notification-bell.css";

const POLL_MS = 60_000;
const LIST_LIMIT = 8;

function relativeTime(iso: string, now: number): string {
  const timestamp = Date.parse(iso);

  if (Number.isNaN(timestamp) || now === 0) {
    return "";
  }

  const seconds = Math.max(Math.round((now - timestamp) / 1000), 0);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  const [unread, setUnread] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProcurementNotification[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  // Used by event handlers (open, mark read, ...). The polling effect below
  // has its own local copy so no state setter is called synchronously in an effect.
  const refreshCount = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount();

      setUnread(result.unreadCount);
    } catch {
      // Keep the previous value; the badge is a convenience, not critical.
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const list = await getNotifications(false);

      setItems(
        [...list]
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, LIST_LIMIT),
      );
      setLoadError(null);
    } catch (caughtError) {
      setLoadError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load notifications.",
      );
    }

    setNow(Date.now());
  }, []);

  // Poll the unread count: once on mount, every minute, and when the tab is shown again.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await getUnreadNotificationCount();

        if (!cancelled) {
          setUnread(result.unreadCount);
        }
      } catch {
        // Keep the previous value; the badge is a convenience, not critical.
      }
    }

    void poll();

    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void poll();
      }
    }, POLL_MS);

    function handleVisibility() {
      if (!document.hidden) {
        void poll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;

    setOpen(next);

    if (next) {
      setNow(Date.now());
      void loadItems();
      void refreshCount();
    }
  }

  function openItem(item: ProcurementNotification) {
    setOpen(false);

    if (!item.read) {
      // Optimistic update, then tell the server.
      setItems((current) =>
        current
          ? current.map((entry) =>
              entry.id === item.id ? { ...entry, read: true } : entry,
            )
          : current,
      );
      setUnread((current) =>
        current === null ? current : Math.max(current - 1, 0),
      );

      markNotificationRead(item.id).catch(() => {
        void refreshCount();
      });
    }

    if (item.href && item.href.startsWith("/")) {
      router.push(item.href);
    }
  }

  async function markAll() {
    setItems((current) =>
      current ? current.map((entry) => ({ ...entry, read: true })) : current,
    );
    setUnread(0);

    try {
      await markAllNotificationsRead();
    } catch {
      void refreshCount();
      void loadItems();
    }
  }

  const unreadCount = unread ?? 0;

  return (
    <div className="bell" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        title="Notifications"
      >
        <Bell size={19} />

        {unreadCount > 0 ? (
          <span className="bell__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="bell__panel" role="dialog" aria-label="Notifications">
          <div className="bell__header">
            <div>
              <strong>Notifications</strong>
              <span>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </span>
            </div>

            <button
              type="button"
              className="bell__mark-all"
              onClick={() => void markAll()}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          </div>

          <div className="bell__body">
            {loadError ? (
              <div className="bell__empty">{loadError}</div>
            ) : items === null ? (
              <div className="bell__loading">
                <div className="skeleton" style={{ height: 46 }} />
                <div className="skeleton" style={{ height: 46 }} />
                <div className="skeleton" style={{ height: 46 }} />
              </div>
            ) : items.length === 0 ? (
              <div className="bell__empty">
                You have no notifications yet.
              </div>
            ) : (
              <ul className="bell__list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`bell-item${item.read ? "" : " bell-item--unread"}`}
                      onClick={() => openItem(item)}
                    >
                      <span
                        className={`bell-item__dot bell-item__dot--${item.severity.toLowerCase()}`}
                        aria-hidden="true"
                      />

                      <span className="bell-item__body">
                        <strong>{item.title}</strong>
                        <span>{item.message}</span>
                        <small>{relativeTime(item.createdAt, now)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/activity"
            className="bell__footer"
            onClick={() => setOpen(false)}
          >
            View all activity
          </Link>
        </div>
      ) : null}
    </div>
  );
}
