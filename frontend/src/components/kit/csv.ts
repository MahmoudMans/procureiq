/**
 * CSV export helpers.
 * - values are quoted and escaped
 * - cells that start with = + - @ are prefixed with ' so spreadsheets never run them as formulas
 * - a UTF-8 BOM is added so Excel opens accents correctly
 */

export type CsvValue = string | number | boolean | null | undefined;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  const text = String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return `"${guarded.replaceAll('"', '""')}"`;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const all: CsvValue[][] = [header, ...rows];

  return all.map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Browser only: call it from an event handler. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: CsvValue[][],
): void {
  const blob = new Blob(["\uFEFF", toCsv(header, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
