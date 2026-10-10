import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`kit-empty${compact ? " kit-empty--compact" : ""}`}>
      <div className="kit-empty__icon">
        <Icon size={22} aria-hidden="true" />
      </div>

      <h3>{title}</h3>

      {description ? <p>{description}</p> : null}

      {action ? <div className="kit-empty__action">{action}</div> : null}
    </div>
  );
}
