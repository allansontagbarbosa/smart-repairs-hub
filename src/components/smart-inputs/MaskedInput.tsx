import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import React, { useCallback } from "react";

// Mask helpers
export function maskCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCnpj(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCpfCnpj(v: string) {
  const digits = v.replace(/\D/g, "");
  return digits.length <= 11 ? maskCpf(v) : maskCnpj(v);
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

export function unMask(v: string) {
  return v.replace(/\D/g, "");
}

interface MaskedInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  mask: "cpf" | "cnpj" | "cpf_cnpj" | "phone" | "cep";
  value: string;
  onValueChange: (raw: string, masked: string) => void;
}

const maskFns = {
  cpf: maskCpf,
  cnpj: maskCnpj,
  cpf_cnpj: maskCpfCnpj,
  phone: maskPhone,
  cep: maskCep,
};

export function MaskedInput({ mask, value, onValueChange, className, ...props }: MaskedInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskFns[mask](e.target.value);
    onValueChange(unMask(masked), masked);
  }, [mask, onValueChange]);

  return (
    <Input
      value={value}
      onChange={handleChange}
      className={cn(className)}
      {...props}
    />
  );
}
