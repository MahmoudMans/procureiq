export interface ActivityEvent {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  status: string | null;
  actorUserId: string | null;
  actorName: string | null;
  summary: string;
  href: string | null;
  occurredAt: string;
}

export type NotificationSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH";

export interface ProcurementNotification {
  id: number;
  notificationType: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadNotificationCount {
  unreadCount: number;
}
