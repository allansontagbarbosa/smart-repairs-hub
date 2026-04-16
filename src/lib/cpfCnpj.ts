/**
 * Utilitários para CPF e CNPJ — armazenamento sempre em dígitos puros,
 * exibição mascarada via formatCpfCnpj.
 */

export function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatCpfCnpj(v: string): string {
  const d = onlyDigits(v);
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d);
}

export function isValidCpf(v: string): boolean {
  const cpf = onlyDigits(v);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cpf.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(cpf.charAt(10), 10);
}

export function isValidCnpj(v: string): boolean {
  const cnpj = onlyDigits(v);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(base.charAt(i), 10) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj, w1);
  if (d1 !== parseInt(cnpj.charAt(12), 10)) return false;
  const d2 = calc(cnpj, w2);
  return d2 === parseInt(cnpj.charAt(13), 10);
}

export function isValidCpfCnpj(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}
