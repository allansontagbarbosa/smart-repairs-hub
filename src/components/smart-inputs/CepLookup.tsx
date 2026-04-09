import { useState, useCallback } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { maskCep, unMask } from "./MaskedInput";
import { toast } from "sonner";

export interface CepData {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento: string;
}

interface CepLookupProps {
  cep: string;
  onCepChange: (cep: string) => void;
  onAddressFound: (data: CepData) => void;
  label?: string;
}

export function CepLookup({ cep, onCepChange, onAddressFound, label = "CEP" }: CepLookupProps) {
  const [loading, setLoading] = useState(false);

  const handleLookup = useCallback(async () => {
    const digits = unMask(cep);
    if (digits.length !== 8) { toast.error("CEP deve ter 8 dígitos"); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      onAddressFound(data);
      toast.success("Endereço preenchido automaticamente!");
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoading(false);
    }
  }, [cep, onAddressFound]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    onCepChange(masked);
    // Auto-search when 8 digits
    const digits = unMask(masked);
    if (digits.length === 8) {
      setTimeout(() => {
        const raw = unMask(masked);
        if (raw.length === 8) {
          setLoading(true);
          fetch(`https://viacep.com.br/ws/${raw}/json/`)
            .then(r => r.json())
            .then(data => {
              if (!data.erro) {
                onAddressFound(data);
                toast.success("Endereço preenchido!");
              }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        }
      }, 300);
    }
  }, [onCepChange, onAddressFound]);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={cep}
          onChange={handleChange}
          placeholder="00000-000"
          className="flex-1"
          maxLength={9}
        />
        <Button type="button" variant="outline" size="icon" onClick={handleLookup} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
