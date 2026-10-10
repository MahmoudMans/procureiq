import type { PortalQuotationStatus } from "@/types/supplier-portal-rfq";

export type PillTone = "success" | "info" | "warning" | "danger" | "neutral";

export function readable(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDeadline(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Accepts 12, 12.5, 12.50 or 12,50. Returns null for anything else (negative, 3 decimals, text). */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(",", ".");

  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}

export function quotationTone(status: PortalQuotationStatus | null): PillTone {
  if (status === "SUBMITTED") {
    return "success";
  }

  if (status === "DRAFT") {
    return "info";
  }

  if (status === "WITHDRAWN") {
    return "warning";
  }

  return "neutral";
}

export function quotationLabel(status: PortalQuotationStatus | null): string {
  if (status === "SUBMITTED") {
    return "Submitted";
  }

  if (status === "DRAFT") {
    return "Draft saved";
  }

  if (status === "WITHDRAWN") {
    return "Withdrawn";
  }

  return "No quotation yet";
}

/** True when the supplier still has something to do on an open RFQ. */
export function needsQuotation(status: PortalQuotationStatus | null): boolean {
  return status === null || status === "DRAFT" || status === "WITHDRAWN";
}

export interface DeadlineNote {
  text: string;
  tone: "late" | "urgent" | "normal";
}

export function deadlineNote(deadline: string, now: number | null): DeadlineNote | null {
  if (now === null) {
    return null;
  }

  const target = new Date(deadline).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const minutes = Math.floor((target - now) / 60000);

  if (minutes <= 0) {
    return { text: "Deadline passed", tone: "late" };
  }

  if (minutes < 60) {
    return { text: `Closes in ${minutes} min`, tone: "urgent" };
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return { text: `Closes in ${hours} h`, tone: "urgent" };
  }

  const days = Math.floor(hours / 24);

  return {
    text: `Closes in ${days} ${days === 1 ? "day" : "days"}`,
    tone: days <= 2 ? "urgent" : "normal",
  };
}
