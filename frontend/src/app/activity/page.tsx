"use client";

import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  FileClock,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getActivity,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";

import type {
  ActivityEvent,
  ProcurementNotification,
} from "@/types/activity";

type ActivityTab =
  | "ACTIVITY"
  | "NOTIFICATIONS";

export default function ActivityPage() {
  const [
    tab,
    setTab,
  ] =
    useState<ActivityTab>(
      "ACTIVITY",
    );

  const [
    events,
    setEvents,
  ] =
    useState<ActivityEvent[]>(
      [],
    );

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      ProcurementNotification[]
    >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    Promise.all([
      getActivity(120),
      getNotifications(false),
      getUnreadNotificationCount(),
    ])
      .then(
        ([
          activityResponse,
          notificationResponse,
          countResponse,
        ]) => {
          if (!active) {
            return;
          }

          setEvents(
            activityResponse,
          );

          setNotifications(
            notificationResponse,
          );

          setUnreadCount(
            countResponse
              .unreadCount,
          );

          setError(
            null,
          );
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError
                  .message
              : "Unable to load activity and notifications.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(
              false,
            );
          }
        },
      );

    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    try {
      setRefreshing(
        true,
      );

      const [
        activityResponse,
        notificationResponse,
        countResponse,
      ] =
        await Promise.all([
          getActivity(120),
          getNotifications(false),
          getUnreadNotificationCount(),
        ]);

      setEvents(
        activityResponse,
      );

      setNotifications(
        notificationResponse,
      );

      setUnreadCount(
        countResponse
          .unreadCount,
      );

      setError(
        null,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to refresh activity.",
      );
    } finally {
      setRefreshing(
        false,
      );
    }
  }

  async function handleMarkRead(
    notification:
      ProcurementNotification,
  ) {
    if (notification.read) {
      return;
    }

    try {
      await markNotificationRead(
        notification.id,
      );

      setNotifications(
        current =>
          current.map(
            item =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    read: true,
                    readAt:
                      new Date(
                        notification.createdAt,
                      )
                        .toISOString(),
                  }
                : item,
          ),
      );

      setUnreadCount(
        current =>
          Math.max(
            0,
            current - 1,
          ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to mark notification as read.",
      );
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();

      setNotifications(
        current =>
          current.map(
            item => ({
              ...item,
              read: true,
            }),
          ),
      );

      setUnreadCount(0);
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to mark notifications as read.",
      );
    }
  }

  const highPriorityCount =
    useMemo(
      () =>
        notifications.filter(
          item =>
            !item.read &&
            item.severity ===
              "HIGH",
        ).length,
      [notifications],
    );

  if (loading) {
    return (
      <div
        className={
          "activity-loading"
        }
      >
        Loading operational
        activity...
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Operational awareness
          </span>

          <h1>
            Activity & alerts
          </h1>

          <p>
            Follow the ProcureIQ
            business-event timeline and
            actionable procurement
            notifications across the
            complete sourcing lifecycle.
          </p>
        </div>

        <button
          type="button"
          className={
            "button button--secondary"
          }
          disabled={
            refreshing
          }
          onClick={
            () =>
              void refresh()
          }
        >
          <RefreshCw
            size={16}
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />

          {error}
        </div>
      ) : null}

      <section
        className={
          "activity-kpi-grid"
        }
      >
        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <FileClock
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Recent events
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {events.length}
          </strong>

          <p>
            Audited business events
            in the current timeline.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Bell size={20} />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Unread alerts
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {unreadCount}
          </strong>

          <p>
            Notifications requiring
            review.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            High priority
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              highPriorityCount
            }
          </strong>

          <p>
            High-severity unread
            operational alerts.
          </p>
        </article>
      </section>

      <section
        className={
          "activity-tabs"
        }
      >
        <button
          type="button"
          className={
            `activity-tab ${
              tab ===
              "ACTIVITY"
                ? "activity-tab--active"
                : ""
            }`
          }
          onClick={
            () =>
              setTab(
                "ACTIVITY",
              )
          }
        >
          Activity timeline
        </button>

        <button
          type="button"
          className={
            `activity-tab ${
              tab ===
              "NOTIFICATIONS"
                ? "activity-tab--active"
                : ""
            }`
          }
          onClick={
            () =>
              setTab(
                "NOTIFICATIONS",
              )
          }
        >
          Notifications

          {unreadCount > 0 ? (
            <span
              className={
                "activity-tab-count"
              }
            >
              {unreadCount}
            </span>
          ) : null}
        </button>
      </section>

      {tab ===
      "ACTIVITY" ? (
        <ActivityTimeline
          events={events}
        />
      ) : (
        <NotificationFeed
          notifications={
            notifications
          }
          unreadCount={
            unreadCount
          }
          onMarkRead={
            handleMarkRead
          }
          onMarkAllRead={
            handleMarkAllRead
          }
        />
      )}
    </div>
  );
}

interface ActivityTimelineProps {
  events:
    ActivityEvent[];
}

function ActivityTimeline({
  events,
}: ActivityTimelineProps) {
  return (
    <section
      className={
        "panel"
      }
    >
      <div
        className={
          "panel__header"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Audit trail
          </span>

          <h2>
            Business-event timeline
          </h2>
        </div>

        <ShieldCheck
          size={19}
        />
      </div>

      {events.length === 0 ? (
        <div
          className={
            "activity-empty"
          }
        >
          No audited activity
          has been recorded yet.
        </div>
      ) : (
        <div
          className={
            "activity-timeline"
          }
        >
          {events.map(
            event => (
              <article
                key={
                  event.id
                }
                className={
                  "activity-event"
                }
              >
                <div
                  className={
                    "activity-event__marker"
                  }
                >
                  <Clock3
                    size={15}
                  />
                </div>

                <div
                  className={
                    "activity-event__content"
                  }
                >
                  <div
                    className={
                      "activity-event__heading"
                    }
                  >
                    <div>
                      <strong>
                        {
                          event.summary
                        }
                      </strong>

                      <span>
                        {
                          event
                            .entityType
                            .replaceAll(
                              "_",
                              " ",
                            )
                        }
                        {" · "}
                        {
                          event.action
                        }
                      </span>
                    </div>

                    <time>
                      {
                        new Date(
                          event
                            .occurredAt,
                        )
                          .toLocaleString()
                      }
                    </time>
                  </div>

                  <div
                    className={
                      "activity-event__meta"
                    }
                  >
                    <span>
                      {
                        event.actorName ??
                        "System"
                      }
                    </span>

                    {event.status ? (
                      <span>
                        Status:
                        {" "}
                        {
                          event.status
                            .replaceAll(
                              "_",
                              " ",
                            )
                        }
                      </span>
                    ) : null}

                    {event.href ? (
                      <Link
                        href={
                          event.href
                        }
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}

interface NotificationFeedProps {
  notifications:
    ProcurementNotification[];
  unreadCount: number;
  onMarkRead: (
    notification:
      ProcurementNotification,
  ) => Promise<void>;
  onMarkAllRead:
    () => Promise<void>;
}

function NotificationFeed({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: NotificationFeedProps) {
  return (
    <section
      className={
        "panel"
      }
    >
      <div
        className={
          "panel__header"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Action center
          </span>

          <h2>
            Procurement alerts
          </h2>
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            className={
              "activity-mark-all"
            }
            onClick={
              () =>
                void onMarkAllRead()
            }
          >
            <CheckCheck
              size={15}
            />

            Mark all read
          </button>
        ) : null}
      </div>

      {notifications.length ===
      0 ? (
        <div
          className={
            "activity-empty"
          }
        >
          You have no procurement
          notifications.
        </div>
      ) : (
        <div
          className={
            "notification-feed"
          }
        >
          {notifications.map(
            notification => (
              <article
                key={
                  notification.id
                }
                className={
                  `notification-card ${
                    notification.read
                      ? "notification-card--read"
                      : ""
                  } notification-card--${
                    notification.severity
                      .toLowerCase()
                  }`
                }
              >
                <div
                  className={
                    "notification-card__icon"
                  }
                >
                  {
                    notification.severity ===
                    "HIGH"
                      ? (
                        <AlertTriangle
                          size={18}
                        />
                      )
                      : notification.severity ===
                        "WARNING"
                        ? (
                          <CircleAlert
                            size={18}
                          />
                        )
                        : (
                          <Bell
                            size={18}
                          />
                        )
                  }
                </div>

                <div
                  className={
                    "notification-card__content"
                  }
                >
                  <div
                    className={
                      "notification-card__heading"
                    }
                  >
                    <strong>
                      {
                        notification
                          .title
                      }
                    </strong>

                    <time>
                      {
                        new Date(
                          notification
                            .createdAt,
                        )
                          .toLocaleString()
                      }
                    </time>
                  </div>

                  <p>
                    {
                      notification
                        .message
                    }
                  </p>

                  <div
                    className={
                      "notification-card__meta"
                    }
                  >
                    <span>
                      {
                        notification
                          .notificationType
                          .replaceAll(
                            "_",
                            " ",
                          )
                      }
                    </span>

                    {notification.href ? (
                      <Link
                        href={
                          notification
                            .href
                        }
                        onClick={
                          () =>
                            void onMarkRead(
                              notification,
                            )
                        }
                      >
                        Open action
                      </Link>
                    ) : null}
                  </div>
                </div>

                {!notification.read ? (
                  <button
                    type="button"
                    className={
                      "notification-read-button"
                    }
                    aria-label={
                      "Mark notification as read"
                    }
                    onClick={
                      () =>
                        void onMarkRead(
                          notification,
                        )
                    }
                  >
                    <Check
                      size={15}
                    />
                  </button>
                ) : (
                  <PackageCheck
                    size={16}
                    className={
                      "notification-read-icon"
                    }
                  />
                )}
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
