import type { LucideIcon } from "lucide-react";

import { Skeleton } from "./skeleton";

export interface KpiItem {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  /** "warning" tints the icon red, for numbers that mean "look at this". */
  tone?: "default" | "warning";
}

interface KpiGridProps {
  items: KpiItem[];
  loading?: boolean;
  ariaLabel: string;
}

/** The headline cards at the top of a list page (same look as the dashboard cards). */
export function KpiGrid({ items, loading = false, ariaLabel }: KpiGridProps) {
  return (
    <section className="kit-kpis" aria-label={ariaLabel}>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <article key={item.label} className="kpi-card">
            <div className="kpi-card__topline">
              <div
                className={`kpi-card__icon${
                  item.tone === "warning" ? " kpi-card__icon--warning" : ""
                }`}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
            </div>

            <span className="kpi-card__label">{item.label}</span>

            {loading ? (
              <Skeleton height={26} width="50%" />
            ) : (
              <strong className="kpi-card__value">{item.value}</strong>
            )}

            {item.note ? <p>{item.note}</p> : null}
          </article>
        );
      })}
    </section>
  );
}
