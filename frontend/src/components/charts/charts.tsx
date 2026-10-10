"use client";

/**
 * charts.tsx
 *
 * Small, dependency-free SVG/CSS charts used by the dashboard.
 *   - AreaChart   smooth trend line with hover tooltip (measures its own width)
 *   - Sparkline   tiny trend line for KPI cards
 *   - DonutChart  share-of-total ring with an interactive legend
 *   - StackedBar  one-bar pipeline / composition view
 *   - BarList     ranked horizontal bars
 *
 * All colours come from CSS variables (see dashboard.css), so every chart
 * follows light / dark mode automatically.
 */
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Tracks an element's pixel width so SVG text stays crisp at any size. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);

      setWidth((current) => (current === next ? current : next));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

interface Point {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds an axis maximum up to a "nice" number (1, 2, 4, 8, 10 x 10^n). */
function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const base = 10 ** Math.floor(Math.log10(value));
  const fraction = value / base;

  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 4 ? 4 : fraction <= 8 ? 8 : 10;

  return nice * base;
}

/** Smooth S-curve between points (control points share the endpoints' y, so it never overshoots). */
function smoothPath(points: Point[]): string {
  return points
    .map((point, index) => {
      if (index === 0) {
        return `M${point.x},${point.y}`;
      }

      const previous = points[index - 1];
      const middle = (previous.x + point.x) / 2;

      return `C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
    })
    .join(" ");
}

/** useId() output can contain characters that break url(#id); keep it simple. */
function safeId(raw: string): string {
  return `g${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function percentLabel(value: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  const percent = (value / total) * 100;

  return percent > 0 && percent < 1 ? "<1%" : `${Math.round(percent)}%`;
}

/* ------------------------------------------------------------------ */
/* AreaChart                                                           */
/* ------------------------------------------------------------------ */

export interface TrendPoint {
  label: string;
  value: number;
  /** Optional second line in the tooltip (e.g. "12 orders"). */
  detail?: string;
}

interface AreaChartProps {
  points: TrendPoint[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  ariaLabel: string;
  height?: number;
}

const AREA_MARGIN = { top: 14, right: 16, bottom: 28, left: 56 };
const GRID_LINES = 4;

export function AreaChart({
  points,
  formatValue,
  formatAxis,
  ariaLabel,
  height = 250,
}: AreaChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const gradientId = safeId(useId());
  const [hover, setHover] = useState<number | null>(null);

  // Keep the same root element in every state so the ResizeObserver stays attached.
  if (width === 0 || points.length === 0) {
    return <div ref={ref} className="chart-box" style={{ height }} />;
  }

  const innerWidth = Math.max(width - AREA_MARGIN.left - AREA_MARGIN.right, 0);
  const innerHeight = height - AREA_MARGIN.top - AREA_MARGIN.bottom;
  const baseline = AREA_MARGIN.top + innerHeight;
  const max = niceCeil(Math.max(0, ...points.map((point) => point.value)));

  const coordinates: Point[] = points.map((point, index) => ({
    x:
      AREA_MARGIN.left +
      (points.length === 1
        ? innerWidth / 2
        : (index / (points.length - 1)) * innerWidth),
    y: baseline - (point.value / max) * innerHeight,
  }));

  const line = smoothPath(coordinates);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const area = `${line} L${last.x},${baseline} L${first.x},${baseline} Z`;

  const active = hover !== null && hover < points.length ? hover : null;
  const labelStep = Math.max(
    1,
    Math.ceil(points.length / Math.max(1, Math.floor(innerWidth / 60))),
  );

  function handlePointerMove(event: ReactPointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    if (bounds.width === 0) {
      return;
    }

    const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);

    setHover(points.length === 1 ? 0 : Math.round(ratio * (points.length - 1)));
  }

  return (
    <div ref={ref} className="chart-box" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="chart-gradient-top" />
            <stop offset="100%" className="chart-gradient-bottom" />
          </linearGradient>
        </defs>

        {Array.from({ length: GRID_LINES + 1 }, (_, step) => {
          const value = (max / GRID_LINES) * step;
          const y = baseline - (value / max) * innerHeight;

          return (
            <g key={step}>
              <line
                className="chart-grid"
                x1={AREA_MARGIN.left}
                x2={AREA_MARGIN.left + innerWidth}
                y1={y}
                y2={y}
              />
              <text
                className="chart-axis"
                x={AREA_MARGIN.left - 10}
                y={y + 4}
                textAnchor="end"
              >
                {formatAxis(value)}
              </text>
            </g>
          );
        })}

        {points.length > 1 ? (
          <>
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} className="chart-line" pathLength={1} />
          </>
        ) : null}

        {points.map((point, index) =>
          index % labelStep === 0 ? (
            <text
              key={`label-${index}`}
              className="chart-axis"
              x={coordinates[index].x}
              y={height - 8}
              textAnchor="middle"
            >
              {point.label}
            </text>
          ) : null,
        )}

        {points.length <= 14
          ? coordinates.map((coordinate, index) => (
              <circle
                key={`dot-${index}`}
                className="chart-dot"
                cx={coordinate.x}
                cy={coordinate.y}
                r={active === index ? 5 : 3.5}
              />
            ))
          : null}

        {active !== null ? (
          <line
            className="chart-guide"
            x1={coordinates[active].x}
            x2={coordinates[active].x}
            y1={AREA_MARGIN.top}
            y2={baseline}
          />
        ) : null}

        <rect
          x={AREA_MARGIN.left}
          y={AREA_MARGIN.top}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {active !== null ? (
        <div
          className="chart-tooltip"
          style={{
            left: clamp(coordinates[active].x, 72, Math.max(width - 72, 72)),
            top: coordinates[active].y,
          }}
        >
          <span>{points[active].label}</span>
          <strong>{formatValue(points[active].value)}</strong>
          {points[active].detail ? <em>{points[active].detail}</em> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 96, height = 34 }: SparklineProps) {
  const gradientId = safeId(useId());

  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 3;

  const coordinates: Point[] = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
  }));

  const line = smoothPath(coordinates);
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="chart-gradient-top" />
          <stop offset="100%" className="chart-gradient-bottom" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} className="chart-line chart-line--thin" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* DonutChart                                                          */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  label: string;
  value: number;
  /** Any CSS colour, normally a var(--token). */
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  formatValue: (value: number) => string;
}

const DONUT_SIZE = 168;
const DONUT_STROKE = 18;

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  formatValue,
}: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);

  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const center = DONUT_SIZE / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = positive.length > 1 ? 2.5 : 0;

  const offsets = positive.map(
    (_, index) =>
      (positive.slice(0, index).reduce((sum, slice) => sum + slice.value, 0) /
        total) *
      circumference,
  );

  const activeSlice = hovered !== null ? (positive[hovered] ?? null) : null;

  return (
    <div className="donut">
      <div className="donut__ring">
        <svg
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          role="img"
          aria-label={`${centerLabel}: ${centerValue}`}
        >
          <circle
            className="donut__track"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={DONUT_STROKE}
          />

          <g transform={`rotate(-90 ${center} ${center})`}>
            {total > 0
              ? positive.map((slice, index) => {
                  const dash = Math.max(
                    (slice.value / total) * circumference - gap,
                    0,
                  );

                  return (
                    <circle
                      key={slice.label}
                      className="donut__slice"
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      strokeWidth={
                        hovered === index ? DONUT_STROKE + 4 : DONUT_STROKE
                      }
                      style={{ stroke: slice.color }}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-offsets[index]}
                      onMouseEnter={() => setHovered(index)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })
              : null}
          </g>
        </svg>

        <div className="donut__center">
          <strong>{activeSlice ? formatValue(activeSlice.value) : centerValue}</strong>
          <span>{activeSlice ? activeSlice.label : centerLabel}</span>
        </div>
      </div>

      <ul className="donut__legend">
        {positive.map((slice, index) => (
          <li
            key={slice.label}
            className={hovered === index ? "is-active" : undefined}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <i style={{ background: slice.color }} aria-hidden="true" />
            <span>{slice.label}</span>
            <strong>{formatValue(slice.value)}</strong>
            <em>{percentLabel(slice.value, total)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StackedBar                                                          */
/* ------------------------------------------------------------------ */

export interface BarSegment {
  label: string;
  value: number;
  color: string;
  /** Small grey text next to the value in the legend (e.g. "4 orders"). */
  note?: string;
}

interface StackedBarProps {
  segments: BarSegment[];
  formatValue: (value: number) => string;
}

export function StackedBar({ segments, formatValue }: StackedBarProps) {
  const positive = segments.filter((segment) => segment.value > 0);
  const total = positive.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return null;
  }

  return (
    <div>
      <div className="stacked-bar" role="img" aria-label="Composition">
        {positive.map((segment) => (
          <div
            key={segment.label}
            className="stacked-bar__segment"
            style={{ flex: `${segment.value} 1 0%`, background: segment.color }}
            title={`${segment.label}: ${formatValue(segment.value)}`}
          />
        ))}
      </div>

      <ul className="stacked-legend">
        {positive.map((segment) => (
          <li key={segment.label}>
            <i style={{ background: segment.color }} aria-hidden="true" />

            <div>
              <span>{segment.label}</span>
              <strong>{formatValue(segment.value)}</strong>
              <small>
                {percentLabel(segment.value, total)}
                {segment.note ? ` · ${segment.note}` : ""}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BarList                                                             */
/* ------------------------------------------------------------------ */

export interface BarListItem {
  label: string;
  value: number;
  /** Share of total, 0-100. */
  share?: number;
}

interface BarListProps {
  items: BarListItem[];
  formatValue: (value: number) => string;
}

export function BarList({ items, formatValue }: BarListProps) {
  const max = Math.max(0, ...items.map((item) => item.value));

  return (
    <ul className="bar-list">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="bar-list__row">
          <div className="bar-list__line">
            <span className="bar-list__label" title={item.label}>
              {item.label}
            </span>

            <span className="bar-list__figures">
              <strong>{formatValue(item.value)}</strong>
              {typeof item.share === "number" ? (
                <em>{item.share.toFixed(1)}%</em>
              ) : null}
            </span>
          </div>

          <div className="bar-list__track">
            <div
              className="bar-list__fill"
              style={{
                width: `${max > 0 ? Math.max((item.value / max) * 100, 1.5) : 0}%`,
                animationDelay: `${index * 40}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
