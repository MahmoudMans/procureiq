"use client";

/**
 * DataTable
 *   - click a header to sort (first click uses `firstSort`, second flips, third clears)
 *   - client-side pagination with page-size picker (remembered per `persistKey`)
 *   - skeleton rows while loading, soft dimming + progress bar while refetching
 *   - jumps back to page 1 whenever `resetKey` changes (pass your filters joined)
 *
 * Define `columns` at module level (or in useMemo) so sorting stays cheap.
 */
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";

export type SortDirection = "asc" | "desc";

export interface SortState {
  id: string;
  dir: SortDirection;
}

type SortValue = string | number | null | undefined;

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. Return a number or a string. */
  sortValue?: (row: T) => SortValue;
  /** Direction used by the first click. Use "desc" for money and dates. */
  firstSort?: SortDirection;
  align?: "left" | "right" | "center";
  width?: string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  ariaLabel: string;
  loading?: boolean;
  /** Refetching while old rows are still shown. */
  busy?: boolean;
  empty?: ReactNode;
  defaultSort?: SortState | null;
  pageSizes?: number[];
  persistKey?: string;
  resetKey?: string;
  rowClassName?: (row: T) => string | undefined;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50];
const SKELETON_WIDTHS = ["62%", "44%", "72%", "38%", "56%"];

function compare(a: SortValue, b: SortValue, dir: SortDirection): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";

  // Empty values always sink to the bottom, whatever the direction.
  if (aEmpty && bEmpty) {
    return 0;
  }

  if (aEmpty) {
    return 1;
  }

  if (bEmpty) {
    return -1;
  }

  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, {
          numeric: true,
          sensitivity: "base",
        });

  return dir === "asc" ? result : -result;
}

function pageWindow(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, count, current - 1, current, current + 1]);

  if (current <= 3) {
    [2, 3, 4].forEach((page) => pages.add(page));
  }

  if (current >= count - 2) {
    [count - 1, count - 2, count - 3].forEach((page) => pages.add(page));
  }

  const ordered = [...pages]
    .filter((page) => page >= 1 && page <= count)
    .sort((a, b) => a - b);

  const result: Array<number | "gap"> = [];
  let previous = 0;

  for (const page of ordered) {
    if (page - previous > 1) {
      result.push("gap");
    }

    result.push(page);
    previous = page;
  }

  return result;
}

function readPageSize(
  key: string | undefined,
  allowed: number[],
  fallback: number,
): number {
  if (!key) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(`procureiq.table.${key}.pageSize`);
    const value = raw ? Number(raw) : Number.NaN;

    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function alignClass(align: Column<unknown>["align"]): string | undefined {
  return align === "right" ? "is-right" : align === "center" ? "is-center" : undefined;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  ariaLabel,
  loading = false,
  busy = false,
  empty,
  defaultSort = null,
  pageSizes = DEFAULT_PAGE_SIZES,
  persistKey,
  resetKey = "",
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() =>
    readPageSize(persistKey, pageSizes, pageSizes[0]),
  );
  const [seenResetKey, setSeenResetKey] = useState(resetKey);

  // New filters -> back to the first page (state adjusted while rendering, no effect needed).
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey);
    setPage(1);
  }

  const sorted = useMemo(() => {
    if (!sort) {
      return rows;
    }

    const accessor = columns.find((column) => column.id === sort.id)?.sortValue;

    if (!accessor) {
      return rows;
    }

    return rows
      .map((row, index) => ({ row, index, value: accessor(row) }))
      .sort(
        (a, b) => compare(a.value, b.value, sort.dir) || a.index - b.index,
      )
      .map((entry) => entry.row);
  }, [rows, columns, sort]);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  function toggleSort(column: Column<T>) {
    const first = column.firstSort ?? "asc";
    const second: SortDirection = first === "asc" ? "desc" : "asc";

    setSort((current) => {
      if (!current || current.id !== column.id) {
        return { id: column.id, dir: first };
      }

      return current.dir === first ? { id: column.id, dir: second } : null;
    });
    setPage(1);
  }

  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);

    if (persistKey) {
      try {
        window.localStorage.setItem(
          `procureiq.table.${persistKey}.pageSize`,
          String(next),
        );
      } catch {
        // Preference just won't be remembered.
      }
    }
  }

  return (
    <div className="kit-table-card" aria-busy={loading || busy}>
      {busy && !loading ? (
        <div className="kit-table-card__progress" aria-hidden="true" />
      ) : null}

      <div className="kit-table-scroll">
        <table
          className={`kit-table${busy && !loading ? " kit-table--busy" : ""}`}
          aria-label={ariaLabel}
        >
          <thead>
            <tr>
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue);
                const active = sort?.id === column.id ? sort : null;

                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={alignClass(column.align)}
                    style={
                      column.width !== undefined ? { width: column.width } : undefined
                    }
                    aria-sort={
                      sortable
                        ? active
                          ? active.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="kit-th-button"
                        data-active={active ? "true" : "false"}
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}

                        {active ? (
                          active.dir === "asc" ? (
                            <ArrowUp size={13} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={13} aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown
                            size={13}
                            className="kit-th-button__idle"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 6) }, (_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((column, columnIndex) => (
                    <td key={column.id} className={alignClass(column.align)}>
                      <Skeleton
                        height={14}
                        width={SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length]}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="kit-table__empty">
                  {empty ?? <EmptyState title="Nothing to show yet" compact />}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={getRowId(row)} className={rowClassName?.(row)}>
                  {columns.map((column) => (
                    <td key={column.id} className={alignClass(column.align)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 ? (
        <div className="kit-table-footer">
          <span aria-live="polite">
            Showing{" "}
            <strong>
              {start + 1}–{start + visible.length}
            </strong>{" "}
            of <strong>{total}</strong>
          </span>

          {total > pageSizes[0] ? (
            <div className="kit-table-footer__controls">
              <label className="kit-page-size">
                <span>Rows</span>

                <select
                  value={pageSize}
                  onChange={(event) => changePageSize(Number(event.target.value))}
                >
                  {pageSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <nav className="kit-pager" aria-label="Pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={15} />
                </button>

                {pageWindow(currentPage, pageCount).map((entry, index) =>
                  entry === "gap" ? (
                    <span key={`gap-${index}`} className="kit-pager__gap">
                      …
                    </span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      aria-label={`Page ${entry}`}
                      aria-current={entry === currentPage ? "page" : undefined}
                      onClick={() => setPage(entry)}
                    >
                      {entry}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </nav>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
