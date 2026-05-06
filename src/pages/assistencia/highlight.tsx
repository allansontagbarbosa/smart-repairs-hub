import type { ReactNode } from "react";
import type { ParsedSearch } from "./searchParser";

const NORM = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function highlight(text: string | null | undefined, parsed: ParsedSearch): ReactNode {
  if (!text) return text ?? "";
  const terms: string[] = [];
  if (parsed.osPrefix) terms.push(parsed.osPrefix);
  if (parsed.imeiPrefix) terms.push(parsed.imeiPrefix);
  if (parsed.telPrefix) terms.push(parsed.telPrefix);
  if (parsed.clientePrefix) terms.push(parsed.clientePrefix);
  terms.push(...parsed.tokens);
  if (terms.length === 0) return text;

  const normText = NORM(text);
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    const normTerm = NORM(term);
    if (normTerm.length < 2) continue;
    let i = 0;
    while ((i = normText.indexOf(normTerm, i)) !== -1) {
      ranges.push([i, i + normTerm.length]);
      i += normTerm.length;
    }
  }
  if (ranges.length === 0) return text;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e], idx) => {
    if (cursor < s) out.push(text.slice(cursor, s));
    out.push(
      <mark key={idx} className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">
        {text.slice(s, e)}
      </mark>
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
