/**
 * Algoritmo de Luhn — usado para validar IMEIs.
 * Alguns aparelhos Android/importados intencionalmente falham no Luhn,
 * por isso o resultado deve ser usado como AVISO, nunca como bloqueio.
 */
export function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
