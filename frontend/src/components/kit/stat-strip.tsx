import { Skeleton } from "./skeleton";

export interface StatItem {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "success";
}

interface StatStripProps {
  items: StatItem[];
  loading?: boolean;
}

/** A compact row of headline numbers, usually computed from the filtered list. */
export function StatStrip({ items, loading = false }: StatStripProps) {
  return (
    <div className="kit-stats">
      {items.map((item) => (
        <div
          key={item.label}
          className={`kit-stat${
            item.tone && item.tone !== "default" ? ` kit-stat--${item.tone}` : ""
          }`}
        >
          <span className="kit-stat__label">{item.label}</span>

          {loading ? (
            <Skeleton height={22} width="55%" />
          ) : (
            <strong className="kit-stat__value">{item.value}</strong>
          )}

          {!loading && item.hint ? (
            <small className="kit-stat__hint">{item.hint}</small>
          ) : null}
        </div>
      ))}
    </div>
  );
}
