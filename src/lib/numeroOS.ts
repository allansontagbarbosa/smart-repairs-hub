/**
 * Formata o número da OS para exibição.
 * - Se `numero_formatado` (texto, ex: "2026-00001") existir, retorna ele.
 * - Caso contrário, faz fallback para o inteiro com padStart(3,"0") (ex: "001").
 *
 * Mantém compatibilidade com OSs antigas que ainda não tenham numero_formatado.
 */
export function formatNumeroOS(
  numero: number | string | null | undefined,
  numeroFormatado?: string | null,
): string {
  if (numeroFormatado && typeof numeroFormatado === "string" && numeroFormatado.trim() !== "") {
    return numeroFormatado;
  }
  if (numero === null || numero === undefined || numero === "") return "—";
  return String(numero).padStart(3, "0");
}

/** Versão com prefixo "OS #" pronto para títulos. */
export function labelOS(
  numero: number | string | null | undefined,
  numeroFormatado?: string | null,
): string {
  return `OS #${formatNumeroOS(numero, numeroFormatado)}`;
}
