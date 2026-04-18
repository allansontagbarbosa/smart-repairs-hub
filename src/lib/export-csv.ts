/**
 * Utilitário único para exportação CSV.
 * Uso:
 *   exportToCsv("pecas.csv", rows, [
 *     { header: "SKU", value: r => r.sku ?? "" },
 *     { header: "Nome", value: r => r.nome },
 *   ]);
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map(c => escape(c.header)).join(";");
  const body = rows.map(r => columns.map(c => escape(c.value(r))).join(";")).join("\n");
  // BOM para Excel reconhecer UTF-8
  const csv = "\uFEFF" + header + "\n" + body;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
