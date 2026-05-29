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
