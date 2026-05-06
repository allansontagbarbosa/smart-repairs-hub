/**
 * Helpers para exportar coleções como CSV ou XLSX no navegador.
 */

export type ExportRow = Record<string, string | number | null | undefined>;

function escapeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\r\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCSV(filename: string, rows: ExportRow[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(";")),
  ].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

export async function downloadXLSX(filename: string, rows: ExportRow[], sheetName = "Dados") {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFilename(resource: string, ext: "csv" | "xlsx"): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${resource}_${yyyy}-${mm}-${dd}_${hh}-${mi}.${ext}`;
}

export async function exportRows(
  resource: string,
  format: "csv" | "xlsx",
  rows: ExportRow[],
  sheetName = "Dados"
) {
  const filename = exportFilename(resource, format);
  if (format === "csv") downloadCSV(filename, rows);
  else await downloadXLSX(filename, rows, sheetName);
}
