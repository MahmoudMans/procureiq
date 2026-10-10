"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Search,
} from "lucide-react";

import { downloadCsv } from "./csv";
import "./smart-table.css";

/**
 * Drop-in replacement for <table className="data-table"> on legacy pages.
 *
 * It reads the <thead>/<tbody> it is given, and adds (without changing the page):
 *   - click / Enter / Space on a header to sort (numbers, money, dates and text)
 *   - a row filter and "Export CSV" once there are 8 or more rows
 *   - paging once there are more than 10 rows
 *
 * Tables it cannot understand (merged cells, custom row components, form fields
 * inside rows, fewer than 2 rows) are rendered exactly as they were.
 */

type AnyProps = Record<string, unknown>;
type El = ReactElement<AnyProps>;
type Direction = "asc" | "desc";

const TOOLBAR_MIN_ROWS = 8;
const FOOTER_MIN_ROWS = 10;
const PAGE_SIZES = [10, 25, 50, 100];
const FIELD_TYPES = new Set(["input", "select", "textarea"]);

function isEl(node: ReactNode): node is El {
  return isValidElement(node);
}

/* ------------------------------------------------------------------ */
/* Text extraction                                                     */
/* ------------------------------------------------------------------ */

function rawText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "bigint"
  ) {
    return String(node);
  }

  if (Array.isArray(node)) {
    let out = "";
    let previousWasBlock = false;

    for (const part of node as ReactNode[]) {
      const text = rawText(part);

      if (!text) {
        continue;
      }

      const isBlock = isEl(part) || Array.isArray(part);

      if (
        out &&
        (isBlock || previousWasBlock) &&
        !/\s$/.test(out) &&
        !/^\s/.test(text)
      ) {
        out += " ";
      }

      out += text;
      previousWasBlock = isBlock;
    }

    return out;
  }

  if (isEl(node)) {
    const props = node.props;
    const inner = rawText(props.children as ReactNode);

    if (inner) {
      return inner;
    }

    if (typeof props.label === "string") {
      return props.label;
    }

    if (typeof props.value === "string") {
      return props.value.replaceAll("_", " ");
    }
  }

  return "";
}

function clean(node: ReactNode): string {
  return rawText(node).replace(/\s+/g, " ").trim();
}

function hasField(node: ReactNode): boolean {
  if (Array.isArray(node)) {
    return (node as ReactNode[]).some(hasField);
  }

  if (isEl(node)) {
    if (typeof node.type === "string" && FIELD_TYPES.has(node.type)) {
      return true;
    }

    return hasField(node.props.children as ReactNode);
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

type SortKey = number | string | null;
type ColumnKind = "number" | "date" | "text";

function isBlank(value: string): boolean {
  const lower = value.toLowerCase();

  return (
    value === "" ||
    value === "—" ||
    value === "–" ||
    value === "-" ||
    lower === "n/a"
  );
}

const CURRENCY = /\b(?:EUR|USD|GBP|TND)\b|[€$£]/gi;

/** "€1.2M", "1,234.50", "12,5 %", "(300)" -> number. Anything else -> null. */
function toNumber(text: string): number | null {
  let body = text.replace(CURRENCY, "").replace(/\s/g, "").replace(/−/g, "-");

  if (!body) {
    return null;
  }

  let sign = 1;

  if (/^\(.*\)$/.test(body)) {
    sign = -1;
    body = body.slice(1, -1);
  }

  const match = /^([-+]?)(\d[\d.,]*|[.,]\d+)([kmb])?%?$/i.exec(body);

  if (!match) {
    return null;
  }

  let digits = match[2];
  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";

    digits = digits.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    digits = /^\d{1,3}(,\d{3})+$/.test(digits)
      ? digits.replace(/,/g, "")
      : digits.replace(/,(?=.*,)/g, "").replace(",", ".");
  } else if ((digits.match(/\./g) ?? []).length > 1) {
    digits = digits.replace(/\./g, "");
  }

  let value = Number(digits);

  if (Number.isNaN(value)) {
    return null;
  }

  const suffix = (match[3] ?? "").toLowerCase();

  if (suffix === "k") {
    value *= 1_000;
  } else if (suffix === "m") {
    value *= 1_000_000;
  } else if (suffix === "b") {
    value *= 1_000_000_000;
  }

  return value * sign * (match[1] === "-" ? -1 : 1);
}

let cachedDateOrder: "dmy" | "mdy" | null = null;

/** Whether this browser writes 09/10/2026 as day-first or month-first. */
function dateOrder(): "dmy" | "mdy" {
  if (cachedDateOrder === null) {
    cachedDateOrder = "dmy";

    for (const part of new Intl.DateTimeFormat(undefined).formatToParts(
      new Date(2001, 10, 25),
    )) {
      if (part.type === "day") {
        break;
      }

      if (part.type === "month") {
        cachedDateOrder = "mdy";
        break;
      }
    }
  }

  return cachedDateOrder;
}

/** Dates and timestamps as shown on the pages -> epoch ms. Anything else -> null. */
function toTime(text: string): number | null {
  const value = text.trim();

  let year = 0;
  let month = 0;
  let day = 0;
  let rest = "";
  let found = false;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/.exec(value);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
    rest = iso[4];
    found = true;
  } else {
    const local = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(.*)$/.exec(value);

    if (local) {
      const first = Number(local[1]);
      const second = Number(local[2]);

      if (dateOrder() === "dmy") {
        day = first;
        month = second;
      } else {
        month = first;
        day = second;
      }

      year = Number(local[3]);
      rest = local[4];
      found = true;
    }
  }

  if (!found) {
    if (
      /^\d{1,2}\s+[A-Za-z]{3,9}\.?,?\s+\d{4}/.test(value) ||
      /^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}/.test(value)
    ) {
      const parsed = Date.parse(value);

      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  const clock = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/.exec(rest);

  if (clock) {
    hours = Number(clock[1]);
    minutes = Number(clock[2]);
    seconds = Number(clock[3] ?? 0);

    const meridiem = (clock[4] ?? "").toLowerCase();

    if (meridiem === "pm" && hours < 12) {
      hours += 12;
    } else if (meridiem === "am" && hours === 12) {
      hours = 0;
    }
  }

  return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
}

function buildKeys(values: string[]): { kind: ColumnKind; keys: SortKey[] } {
  const numbers = values.map((value) => (isBlank(value) ? null : toNumber(value)));

  if (
    values.some((value) => !isBlank(value)) &&
    values.every((value, index) => isBlank(value) || numbers[index] !== null)
  ) {
    return { kind: "number", keys: numbers };
  }

  const times = values.map((value) => (isBlank(value) ? null : toTime(value)));

  if (
    values.some((value) => !isBlank(value)) &&
    values.every((value, index) => isBlank(value) || times[index] !== null)
  ) {
    return { kind: "date", keys: times };
  }

  return {
    kind: "text",
    keys: values.map((value) => (isBlank(value) ? null : value)),
  };
}

interface RowModel {
  element: El;
  cells: string[];
  haystack: string;
}

function sortRows(rows: RowModel[], column: number, dir: Direction): RowModel[] {
  const { kind, keys } = buildKeys(rows.map((row) => row.cells[column] ?? ""));
  const order = rows.map((_, index) => index);

  order.sort((a, b) => {
    const left = keys[a];
    const right = keys[b];

    if (left === null && right === null) {
      return a - b;
    }

    if (left === null) {
      return 1;
    }

    if (right === null) {
      return -1;
    }

    const diff =
      kind === "text"
        ? String(left).localeCompare(String(right), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : Number(left) - Number(right);

    if (diff === 0) {
      return a - b;
    }

    return dir === "asc" ? diff : -diff;
  });

  return order.map((index) => rows[index]);
}

/* ------------------------------------------------------------------ */
/* Structure analysis                                                  */
/* ------------------------------------------------------------------ */

interface Analysis {
  thead: El;
  headerRow: El;
  headers: El[];
  tbody: El;
  rows: RowModel[];
}

function isCell(node: ReactNode): node is El {
  return (
    isEl(node) &&
    (node.type === "td" || node.type === "th") &&
    node.props.colSpan === undefined &&
    node.props.rowSpan === undefined
  );
}

function analyse(all: ReactNode[]): Analysis | null {
  let thead: El | null = null;
  let tbody: El | null = null;

  for (const child of all) {
    if (isEl(child) && child.type === "thead") {
      thead = child;
    } else if (isEl(child) && child.type === "tbody") {
      tbody = child;
    }
  }

  if (!thead || !tbody) {
    return null;
  }

  const headRows = Children.toArray(thead.props.children as ReactNode);

  if (headRows.length !== 1) {
    return null;
  }

  const headerRow = headRows[0];

  if (!isEl(headerRow) || headerRow.type !== "tr") {
    return null;
  }

  const headers: El[] = [];

  for (const cell of Children.toArray(headerRow.props.children as ReactNode)) {
    if (!isCell(cell)) {
      return null;
    }

    headers.push(cell);
  }

  if (headers.length === 0) {
    return null;
  }

  const rows: RowModel[] = [];

  for (const row of Children.toArray(tbody.props.children as ReactNode)) {
    if (!isEl(row) || row.type !== "tr" || hasField(row)) {
      return null;
    }

    const cells = Children.toArray(row.props.children as ReactNode);

    if (cells.length !== headers.length || !cells.every(isCell)) {
      return null;
    }

    const texts = cells.map((cell) => clean(cell));

    rows.push({
      element: row,
      cells: texts,
      haystack: texts.join(" ").toLowerCase(),
    });
  }

  if (rows.length < 2) {
    return null;
  }

  return { thead, headerRow, headers, tbody, rows };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type SmartTableProps = ComponentPropsWithoutRef<"table">;

export function SmartTable({ children, ...rest }: SmartTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const [sort, setSort] = useState<{ column: number; dir: Direction } | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const all = Children.toArray(children);
  const analysis = analyse(all);

  let toolbar: ReactNode = null;
  let footer: ReactNode = null;
  let content: ReactNode = children;

  if (analysis) {
    const query = filter.trim().toLowerCase();

    const filtered = query
      ? analysis.rows.filter((row) => row.haystack.includes(query))
      : analysis.rows;

    const ordered = sort ? sortRows(filtered, sort.column, sort.dir) : filtered;
    const total = ordered.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, pageCount - 1);
    const visible = ordered.slice(current * pageSize, (current + 1) * pageSize);

    const toggle = (column: number) => {
      const { kind } = buildKeys(analysis.rows.map((row) => row.cells[column] ?? ""));
      const first: Direction = kind === "text" ? "asc" : "desc";

      setPage(0);
      setSort((existing) => {
        if (!existing || existing.column !== column) {
          return { column, dir: first };
        }

        if (existing.dir === first) {
          return { column, dir: first === "asc" ? "desc" : "asc" };
        }

        return null;
      });
    };

    const exportCsv = () => {
      const keep: number[] = [];

      analysis.headers.forEach((header, index) => {
        if (clean(header) !== "") {
          keep.push(index);
        }
      });

      const title =
        tableRef.current?.closest("section")?.querySelector("h2")?.textContent ?? "";
      const slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "table";

      downloadCsv(
        `procureiq-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
        keep.map((index) => clean(analysis.headers[index])),
        ordered.map((row) => keep.map((index) => row.cells[index] ?? "")),
      );
    };

    const headerCells = analysis.headers.map((th, index) => {
      const label = clean(th);

      if (!label) {
        return th;
      }

      const active = sort && sort.column === index ? sort.dir : null;
      const existingClass = typeof th.props.className === "string" ? th.props.className : "";

      return cloneElement(
        th,
        {
          className: [existingClass, "smart-th"].filter(Boolean).join(" "),
          tabIndex: 0,
          "aria-sort":
            active === "asc" ? "ascending" : active === "desc" ? "descending" : "none",
          onClick: () => toggle(index),
          onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggle(index);
            }
          },
        },
        [
          ...Children.toArray(th.props.children as ReactNode),
          <span key="smart-sort" className="smart-sort" aria-hidden="true">
            {active === "asc" ? (
              <ChevronUp size={13} />
            ) : active === "desc" ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronsUpDown size={13} />
            )}
          </span>,
        ],
      );
    });

    content = all.map((child) => {
      if (child === analysis.thead) {
        return cloneElement(
          analysis.thead,
          undefined,
          cloneElement(analysis.headerRow, undefined, headerCells),
        );
      }

      if (child === analysis.tbody) {
        return cloneElement(
          analysis.tbody,
          undefined,
          visible.map((row) => row.element),
        );
      }

      return child;
    });

    if (analysis.rows.length >= TOOLBAR_MIN_ROWS) {
      toolbar = (
        <div className="smart-table__toolbar">
          <label className="smart-table__filter">
            <Search size={14} aria-hidden="true" />

            <input
              type="search"
              className="smart-table__input"
              value={filter}
              placeholder="Filter rows"
              aria-label="Filter table rows"
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(0);
              }}
            />
          </label>

          <span className="smart-table__count">
            {filtered.length === analysis.rows.length
              ? `${analysis.rows.length} rows`
              : `${filtered.length} of ${analysis.rows.length} rows`}
          </span>

          <button
            type="button"
            className="smart-table__export"
            onClick={exportCsv}
            disabled={total === 0}
          >
            <Download size={14} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      );
    }

    if (total > FOOTER_MIN_ROWS || query) {
      footer = (
        <div className="smart-table__footer">
          {total === 0 ? (
            <span>No rows match “{filter.trim()}”.</span>
          ) : (
            <>
              <span>
                Showing {current * pageSize + 1}–{Math.min((current + 1) * pageSize, total)}{" "}
                of {total}
              </span>

              <div className="smart-table__pager">
                <label>
                  Rows
                  <select
                    className="smart-table__select"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(0);
                    }}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="smart-table__page-button"
                  aria-label="Previous page"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft size={15} />
                </button>

                <span>
                  Page {current + 1} of {pageCount}
                </span>

                <button
                  type="button"
                  className="smart-table__page-button"
                  aria-label="Next page"
                  disabled={current >= pageCount - 1}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
  }

  return (
    <>
      {toolbar}

      <table {...rest} ref={tableRef}>
        {content}
      </table>

      {footer}
    </>
  );
}
