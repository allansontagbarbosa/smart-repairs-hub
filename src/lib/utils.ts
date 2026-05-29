import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function maskCPF(cpf: string): string {
  if (!cpf || cpf.length < 11) return cpf;
  return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

export function maskIMEI(imei: string): string {
  if (!imei || imei.length < 15) return imei;
  return `${imei.slice(0, 2)} ${imei.slice(2, 6)} ${imei.slice(6, 10)} ${imei.slice(10, 15)}`;
}

/**
 * Valida CPF pelo algoritmo dos dígitos verificadores.
 */
export function isValidCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = 11 - (s % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = 11 - (s % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

export function formatCPFInput(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}

export function formatCEPInput(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 8);
  if (v.length <= 5) return v;
  return `${v.slice(0, 5)}-${v.slice(5)}`;
}

export function formatTelInput(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length === 0) return v;
  if (v.length <= 2) return `(${v}`;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}

/**
 * Limite sugerido: 1.5x renda mensal, min R$200, max R$10.000, arredondado em R$50.
 */
export function sugerirLimite(rendaMensal: number): number {
  if (!rendaMensal || rendaMensal <= 0) return 0;
  const sugerido = rendaMensal * 1.5;
  return Math.max(200, Math.min(10000, Math.round(sugerido / 50) * 50));
}
