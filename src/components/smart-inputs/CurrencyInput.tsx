import { Input } from "@/components/ui/input";
import React, { useState, useCallback } from "react";

interface CurrencyInputProps {
  value: number | null | undefined;
  onValueChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({ value, onValueChange, placeholder = "Digite o valor", className, disabled }: CurrencyInputProps) {
  const [display, setDisplay] = useState(() =>
    value && value > 0 ? value.toString().replace(".", ",") : ""
  );
  const [focused, setFocused] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d,.-]/g, "");
    setDisplay(raw);
    const num = parseFloat(raw.replace(",", ".")) || 0;
    onValueChange(num);
  }, [onValueChange]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const num = parseFloat(display.replace(",", ".")) || 0;
    if (num > 0) {
      setDisplay(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      setDisplay("");
    }
    onValueChange(num);
  }, [display, onValueChange]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    const num = parseFloat(display.replace(/\./g, "").replace(",", ".")) || 0;
    if (num > 0) {
      setDisplay(num.toString().replace(".", ","));
    }
  }, [display]);

  return (
    <Input
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      inputMode="decimal"
    />
  );
}
