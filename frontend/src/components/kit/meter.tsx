import type { BadgeTone } from "./status-badge";

export type MeterTone = "primary" | "success" | "warning" | "danger";

/** Bar colour that matches a badge colour (for health / status driven bars). */
export function meterToneFor(tone: BadgeTone): MeterTone {
  switch (tone) {
    case "success":
      return "success";

    case "warning":
    case "high":
      return "warning";

    case "danger":
      return "danger";

    default:
      return "primary";
  }
}

interface MeterProps {
  value: number;
  max?: number;
  /** Text shown beside the bar, e.g. "3 / 5" or "62.5%". */
  label?: string;
  tone?: MeterTone;
  ariaLabel?: string;
}

/** A slim progress bar for table cells (onboarding gates, savings, budgets). */
export function Meter({
  value,
  max = 100,
  label,
  tone = "primary",
  ariaLabel,
}: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div
      className="kit-meter"
      role="meter"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
    >
      <span className="kit-meter__track">
        <i
          className={`kit-meter__fill kit-meter__fill--${tone}`}
          style={{ width: `${percent}%` }}
        />
      </span>

      {label ? <span className="kit-meter__label">{label}</span> : null}
    </div>
  );
}
