// Natural sort: "iPhone 5" < "iPhone 6" < "iPhone 11" < "iPhone 12"
// Uses Intl.Collator with numeric:true.
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function naturalCompare(a: string, b: string): number {
  return collator.compare(a ?? "", b ?? "");
}

export function sortByNomeNatural<T extends { nome?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => naturalCompare(a.nome ?? "", b.nome ?? ""));
}

// Extract leading numeric value from a string (e.g. "128GB" -> 128, "1TB" -> 1024).
export function parseCapacidade(nome: string): number {
  if (!nome) return 0;
  const n = nome.trim().toUpperCase();
  const m = n.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)?/);
  if (!m) return 0;
  let val = parseFloat(m[1].replace(",", "."));
  const unit = m[2];
  if (unit === "TB") val *= 1024;
  else if (unit === "MB") val /= 1024;
  return val;
}

export function sortCapacidades<T extends { nome?: string | null; ordem?: number | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const pa = parseCapacidade(a.nome ?? "");
    const pb = parseCapacidade(b.nome ?? "");
    if (pa !== pb) return pa - pb;
    return naturalCompare(a.nome ?? "", b.nome ?? "");
  });
}
