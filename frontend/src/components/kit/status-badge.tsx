import { readable } from "./format";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "high"
  | "danger"
  | "accent";

/**
 * One place that decides which colour a status gets, so "Approved" is green
 * on every page. Unknown values fall back to neutral grey.
 */
const TONE_BY_STATUS: Record<string, BadgeTone> = {
  ACTIVE: "success",
  APPROVED: "success",
  PAID: "success",
  RECEIVED: "success",
  COMPLETED: "success",
  RESOLVED: "success",
  VALID: "success",
  MATCHED: "success",
  ISSUED: "success",
  CONVERTED: "success",
  VERIFIED: "success",
  CLEARED: "success",
  HEALTHY: "success",
  ON_TRACK: "success",
  AGREED: "success",
  READY_FOR_PAYMENT: "success",
  LOW: "success",
  EXCELLENT: "success",
  VALIDATED: "success",
  REALIZED: "success",
  OK: "success",
  NORMAL: "success",
  COMPLETE: "success",
  ACHIEVED: "success",

  SUBMITTED: "info",
  ONBOARDING: "info",
  PUBLISHED: "info",
  IN_PROGRESS: "info",
  IN_REVIEW: "info",
  OPEN: "info",
  PLANNED: "info",
  INVITED: "info",
  SOURCING: "info",
  ACKNOWLEDGED: "info",
  GOOD: "info",
  READY: "info",
  PROPOSED: "info",
  IDENTIFIED: "info",
  INFO: "info",
  PLANNING: "info",
  SCHEDULED: "info",

  PENDING: "warning",
  MEDIUM: "warning",
  PARTIALLY_RECEIVED: "warning",
  ON_HOLD: "warning",
  EXPIRING_SOON: "warning",
  WARNING: "warning",
  WATCH: "warning",
  MATCH_PENDING: "warning",
  UNDER_REVIEW: "warning",
  DEFERRED: "warning",
  IN_MITIGATION: "warning",
  NEEDS_IMPROVEMENT: "warning",
  PENDING_VALIDATION: "warning",
  AT_RISK: "warning",
  NEEDS_ATTENTION: "warning",
  DELAYED: "warning",
  BEHIND: "warning",

  HIGH: "high",

  REJECTED: "danger",
  CRITICAL: "danger",
  SUSPENDED: "danger",
  OVERDUE: "danger",
  EXPIRED: "danger",
  EXCEPTION: "danger",
  PAYMENT_HOLD: "danger",
  BREACHED: "danger",
  TERMINATED: "danger",
  FAILED: "danger",
  OFF_TRACK: "danger",
  BLOCKED: "danger",
  EXCEEDED: "danger",

  AWARDED: "accent",
  CLOSED: "accent",

  DRAFT: "neutral",
  CANCELLED: "neutral",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
  WITHDRAWN: "neutral",
  DISMISSED: "neutral",
  ACCEPTED: "neutral",
  NOT_RUN: "neutral",
  SUPERSEDED: "neutral",
  RETIRED: "neutral",
  NOT_STARTED: "neutral",
};

export function toneFor(value: string): BadgeTone {
  return TONE_BY_STATUS[value.trim().toUpperCase().replaceAll(" ", "_")] ?? "neutral";
}

interface StatusBadgeProps {
  /** Raw API value, e.g. "PARTIALLY_RECEIVED". */
  value: string;
  /** Overrides the automatic label. */
  label?: string;
  /** Overrides the automatic colour. */
  tone?: BadgeTone;
  dot?: boolean;
}

export function StatusBadge({ value, label, tone, dot = true }: StatusBadgeProps) {
  const resolved = tone ?? toneFor(value);

  return (
    <span className={`kit-badge kit-badge--${resolved}`}>
      {dot ? <i className="kit-badge__dot" aria-hidden="true" /> : null}
      {label ?? readable(value)}
    </span>
  );
}
