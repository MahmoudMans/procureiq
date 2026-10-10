/**
 * Small formatting helpers shared by list pages.
 */

const formatters = new Map<string, Intl.NumberFormat>();

/** Currency formatter with a cache (building Intl.NumberFormat per row is slow). */
export function formatMoney(
  amount: number,
  currency = "EUR",
  compact = false,
): string {
  const key = `${currency}|${compact ? "c" : "f"}`;
  let formatter = formatters.get(key);

  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
      });
    } catch {
      // Unknown currency code: fall back to a plain number plus the code.
      return `${Math.round(amount).toLocaleString("en-US")} ${currency}`;
    }

    formatters.set(key, formatter);
  }

  return formatter.format(amount);
}

/** "PARTIALLY_RECEIVED" -> "Partially received". */
export function readable(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Accepts "2026-03-14" (treated as a local date) or a full ISO timestamp. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Date plus time, for deadlines and timestamps. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today as YYYY-MM-DD in local time, comparable with the API's date-only strings. */
export function todayIso(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** Epoch milliseconds for a date or timestamp string; null when it can't be parsed. */
export function timeOf(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const time = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`).getTime()
    : Date.parse(value);

  return Number.isNaN(time) ? null : time;
}
