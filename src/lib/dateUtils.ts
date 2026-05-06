/**
 * Retorna a data no formato YYYY-MM-DD usando o timezone LOCAL do navegador.
 * Diferente de `date.toISOString().split("T")[0]`, que usa UTC e desloca a data
 * em horários próximos da meia-noite.
 *
 * Exemplo: 06/05/2026 às 23h em São Paulo (UTC-3):
 *   - toISOString().split("T")[0] → "2026-05-07"  ❌
 *   - dateOnlyLocal(new Date())   → "2026-05-06"  ✓
 */
export function dateOnlyLocal(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Mesma ideia, mas retorna `YYYY-MM` (mês de competência).
 */
export function monthKeyLocal(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
