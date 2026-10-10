"use client";

import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  Download,
  FileClock,
  PackageCheck,
  RefreshCw,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  EmptyState,
  KpiGrid,
  type KpiItem,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  SelectField,
  type SelectOption,
  Skeleton,
  downloadCsv,
  formatDate,
  formatDateTime,
  readable,
  todayIso,
  useToast,
} from "@/components/kit";
import {
  getActivity,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import type { ActivityEvent, ProcurementNotification } from "@/types/activity";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ActivityTab = "ACTIVITY" | "NOTIFICATIONS";

const PAGE_SIZE = 40;

const EMPTY_EVENTS: ActivityEvent[] = [];
const EMPTY_NOTIFICATIONS: ProcurementNotification[] = [];

const FEED_FILTERS: SegmentedOption[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
];

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dayKeyOf(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "unknown" : localDayKey(date);
}

function timeOfDay(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function messageOf(result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") {
    return null;
  }

  return result.reason instanceof Error
    ? result.reason.message
    : "Unable to load activity and notifications.";
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "HIGH") {
    return <AlertTriangle size={18} />;
  }

  if (severity === "WARNING") {
    return <CircleAlert size={18} />;
  }

  return <Bell size={18} />;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ActivityPage() {
  const toast = useToast();

  const [today] = useState(() => todayIso());
  const [yesterday] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);

    return localDayKey(date);
  });

  const [tab, setTab] = useState<ActivityTab>("ACTIVITY");
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [notifications, setNotifications] = useState<ProcurementNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [feedFilter, setFeedFilter] = useState("ALL");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      const [activityResult, notificationResult, countResult] = await Promise.allSettled([
        getActivity(120),
        getNotifications(false),
        getUnreadNotificationCount(),
      ]);

      if (!active) {
        return;
      }

      if (activityResult.status === "fulfilled") {
        setEvents(activityResult.value);
      }

      if (notificationResult.status === "fulfilled") {
        setNotifications(notificationResult.value);
      }

      if (countResult.status === "fulfilled") {
        setUnreadCount(countResult.value.unreadCount);
      }

      setError(
        messageOf(activityResult) ?? messageOf(notificationResult) ?? messageOf(countResult),
      );

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [reloadKey]);

  const allEvents = events ?? EMPTY_EVENTS;
  const allNotifications = notifications ?? EMPTY_NOTIFICATIONS;

  const entityOptions = useMemo<SelectOption[]>(() => {
    const unique = Array.from(new Set(allEvents.map((event) => event.entityType))).sort();

    return [
      { value: "", label: "All" },
      ...unique.map((value) => ({ value, label: readable(value) })),
    ];
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return allEvents
      .filter((event) => !entityType || event.entityType === entityType)
      .filter(
        (event) =>
          !normalized ||
          [
            event.summary,
            event.entityType,
            event.action,
            event.actorName ?? "",
            event.status ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [allEvents, query, entityType]);

  const shown = useMemo(() => filteredEvents.slice(0, visible), [filteredEvents, visible]);

  const groups = useMemo(() => {
    const byDay = new Map<string, ActivityEvent[]>();

    for (const event of shown) {
      const key = dayKeyOf(event.occurredAt);
      const list = byDay.get(key);

      if (list) {
        list.push(event);
      } else {
        byDay.set(key, [event]);
      }
    }

    return Array.from(byDay, ([key, items]) => ({ key, items }));
  }, [shown]);

  const feed = useMemo(
    () =>
      feedFilter === "UNREAD"
        ? allNotifications.filter((item) => !item.read)
        : allNotifications,
    [allNotifications, feedFilter],
  );

  const highPriority = useMemo(
    () => allNotifications.filter((item) => !item.read && item.severity === "HIGH").length,
    [allNotifications],
  );

  function dayLabel(key: string): string {
    if (key === today) {
      return "Today";
    }

    if (key === yesterday) {
      return "Yesterday";
    }

    return key === "unknown" ? "Unknown date" : formatDate(key);
  }

  async function handleMarkRead(notification: ProcurementNotification) {
    if (notification.read) {
      return;
    }

    try {
      await markNotificationRead(notification.id);

      setNotifications((current) =>
        current === null
          ? current
          : current.map((item) =>
              item.id === notification.id
                ? { ...item, read: true, readAt: new Date().toISOString() }
                : item,
            ),
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (caught) {
      toast.error(
        "Could not mark as read",
        caught instanceof Error ? caught.message : "Unable to mark notification as read.",
      );
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();

      setNotifications((current) =>
        current === null ? current : current.map((item) => ({ ...item, read: true })),
      );

      setUnreadCount(0);

      toast.success("All notifications marked as read");
    } catch (caught) {
      toast.error(
        "Could not mark notifications as read",
        caught instanceof Error
          ? caught.message
          : "Unable to mark notifications as read.",
      );
    }
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Occurred at", "Summary", "Entity type", "Action", "Actor", "Status"],
      filteredEvents.map((event) => [
        event.occurredAt,
        event.summary,
        event.entityType,
        event.action,
        event.actorName ?? "System",
        event.status ?? "",
      ]),
    );

    toast.success(
      "Activity exported",
      `${filteredEvents.length} ${filteredEvents.length === 1 ? "event" : "events"} saved as CSV.`,
    );
  }

  const tabOptions: SegmentedOption[] = [
    { value: "ACTIVITY", label: "Activity timeline" },
    {
      value: "NOTIFICATIONS",
      label: unreadCount > 0 ? `Notifications · ${unreadCount}` : "Notifications",
    },
  ];

  const kpis: KpiItem[] = [
    {
      label: "Recent events",
      icon: FileClock,
      value: events ? String(events.length) : "—",
      note: "Audited business events in the current timeline.",
    },
    {
      label: "Unread alerts",
      icon: Bell,
      value: notifications ? String(unreadCount) : "—",
      note: "Notifications requiring review.",
    },
    {
      label: "High priority",
      icon: AlertTriangle,
      value: notifications ? String(highPriority) : "—",
      note: "High-severity unread operational alerts.",
      tone: highPriority > 0 ? "warning" : "default",
    },
  ];

  const hasEventFilters = query.trim() !== "" || entityType !== "";
  const initialLoad = events === null && notifications === null && error === null;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Operational awareness</span>

          <h1>Activity &amp; alerts</h1>

          <p>
            Follow the ProcureIQ business-event timeline and actionable procurement
            notifications across the complete sourcing lifecycle.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {tab === "ACTIVITY" ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={exportCsv}
              disabled={filteredEvents.length === 0}
            >
              <Download size={15} />
              Export CSV
            </button>
          ) : null}
        </div>
      </section>

      <KpiGrid items={kpis} loading={initialLoad} ariaLabel="Activity totals" />

      <SegmentedFilter
        options={tabOptions}
        value={tab}
        onChange={(value) => setTab(value === "NOTIFICATIONS" ? "NOTIFICATIONS" : "ACTIVITY")}
        ariaLabel="Activity view"
      />

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {tab === "ACTIVITY" ? (
        <>
          <div className="kit-toolbar">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search events, actors or statuses"
              ariaLabel="Search activity"
              shortcut
            />

            <SelectField
              label="Type"
              value={entityType}
              onChange={(value) => {
                setEntityType(value);
                setVisible(PAGE_SIZE);
              }}
              options={entityOptions}
            />
          </div>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Audit trail</span>

                <h2>Business-event timeline</h2>
              </div>

              <ShieldCheck size={19} />
            </div>

            {events === null && error === null ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
              </div>
            ) : null}

            {events !== null && filteredEvents.length === 0 ? (
              hasEventFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="No events match these filters"
                  description="Try a different search term or type, or clear the filters."
                  action={
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        setQuery("");
                        setEntityType("");
                      }}
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={FileClock}
                  title="No audited activity yet"
                  description="Business events appear here as people work in ProcureIQ."
                />
              )
            ) : null}

            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="kit-day-heading">{dayLabel(group.key)}</h3>

                <div className="activity-timeline">
                  {group.items.map((event) => (
                    <article key={event.id} className="activity-event">
                      <div className="activity-event__marker">
                        <Clock3 size={15} />
                      </div>

                      <div className="activity-event__content">
                        <div className="activity-event__heading">
                          <div>
                            <strong>{event.summary}</strong>

                            <span>
                              {readable(event.entityType)} · {readable(event.action)}
                            </span>
                          </div>

                          <time dateTime={event.occurredAt}>
                            {timeOfDay(event.occurredAt)}
                          </time>
                        </div>

                        <div className="activity-event__meta">
                          <span>{event.actorName ?? "System"}</span>

                          {event.status ? <span>Status: {readable(event.status)}</span> : null}

                          {event.href ? <Link href={event.href}>Open</Link> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}

            {filteredEvents.length > visible ? (
              <div className="kit-load-more">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                >
                  Show more ({filteredEvents.length - visible} remaining)
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <div className="kit-toolbar">
            <SegmentedFilter
              options={FEED_FILTERS}
              value={feedFilter}
              onChange={setFeedFilter}
              ariaLabel="Filter notifications"
            />

            {unreadCount > 0 ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void handleMarkAllRead()}
              >
                <CheckCheck size={15} />
                Mark all read
              </button>
            ) : null}
          </div>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Action center</span>

                <h2>Procurement alerts</h2>
              </div>

              <Bell size={19} />
            </div>

            {notifications === null && error === null ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Skeleton height={76} />
                <Skeleton height={76} />
                <Skeleton height={76} />
              </div>
            ) : null}

            {notifications !== null && feed.length === 0 ? (
              feedFilter === "UNREAD" ? (
                <EmptyState
                  icon={CheckCheck}
                  title="You're all caught up"
                  description="There are no unread notifications."
                  action={
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => setFeedFilter("ALL")}
                    >
                      Show all notifications
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Bell}
                  title="No procurement notifications"
                  description="Alerts about approvals, deliveries and risks will appear here."
                />
              )
            ) : null}

            {feed.length > 0 ? (
              <div className="notification-feed">
                {feed.map((notification) => (
                  <article
                    key={notification.id}
                    className={`notification-card ${
                      notification.read ? "notification-card--read" : ""
                    } notification-card--${notification.severity.toLowerCase()}`}
                  >
                    <div className="notification-card__icon">
                      <SeverityIcon severity={notification.severity} />
                    </div>

                    <div className="notification-card__content">
                      <div className="notification-card__heading">
                        <strong>{notification.title}</strong>

                        <time dateTime={notification.createdAt}>
                          {formatDateTime(notification.createdAt)}
                        </time>
                      </div>

                      <p>{notification.message}</p>

                      <div className="notification-card__meta">
                        <span>{readable(notification.notificationType)}</span>

                        {notification.href ? (
                          <Link
                            href={notification.href}
                            onClick={() => void handleMarkRead(notification)}
                          >
                            Open action
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    {!notification.read ? (
                      <button
                        type="button"
                        className="notification-read-button"
                        aria-label="Mark notification as read"
                        onClick={() => void handleMarkRead(notification)}
                      >
                        <Check size={15} />
                      </button>
                    ) : (
                      <PackageCheck size={16} className="notification-read-icon" />
                    )}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
