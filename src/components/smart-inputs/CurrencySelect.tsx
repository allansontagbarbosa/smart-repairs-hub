import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const currencies = [
  { code: "BRL", label: "Real (R$)", symbol: "R$", decimal: ",", thousands: "." },
  { code: "USD", label: "Dólar (US$)", symbol: "US$", decimal: ".", thousands: "," },
  { code: "EUR", label: "Euro (€)", symbol: "€", decimal: ",", thousands: "." },
];

interface Props {
  value: string;
  onValueChange: (code: string) => void;
}

export function CurrencySelect({ value, onValueChange }: Props) {
  return (
    <div>
      <Label>Moeda</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {currencies.map((c) => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { currencies };
