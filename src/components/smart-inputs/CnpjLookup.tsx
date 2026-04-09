import { useState, useCallback } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaskedInput, unMask } from "./MaskedInput";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface CnpjData {
  nome: string;
  fantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  situacao: string;
}

interface CnpjLookupProps {
  value: string;
  onValueChange: (masked: string) => void;
  onDataFound: (data: CnpjData) => void;
  label?: string;
  mask?: "cpf_cnpj" | "cnpj";
}

export function CnpjLookup({ value, onValueChange, onDataFound, label = "CNPJ/CPF", mask = "cpf_cnpj" }: CnpjLookupProps) {
  const [loading, setLoading] = useState(false);

  const handleLookup = useCallback(async () => {
    const digits = unMask(value);
    if (digits.length !== 14) { toast.error("Informe um CNPJ válido (14 dígitos) para consulta"); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) { toast.error("CNPJ não encontrado"); return; }
      const d = await res.json();
      const data: CnpjData = {
        nome: d.razao_social || "",
        fantasia: d.nome_fantasia || "",
        logradouro: `${d.logradouro || ""}${d.numero ? `, ${d.numero}` : ""}`,
        numero: d.numero || "",
        bairro: d.bairro || "",
        municipio: d.municipio || "",
        uf: d.uf || "",
        cep: d.cep || "",
        email: d.email || "",
        telefone: d.ddd_telefone_1 || "",
        situacao: d.descricao_situacao_cadastral || "",
      };
      onDataFound(data);
      toast.success("Dados preenchidos automaticamente!");
    } catch {
      toast.error("Erro ao consultar CNPJ");
    } finally {
      setLoading(false);
    }
  }, [value, onDataFound]);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <MaskedInput
          mask={mask}
          value={value}
          onValueChange={(_, masked) => onValueChange(masked)}
          placeholder={mask === "cnpj" ? "00.000.000/0000-00" : "CPF ou CNPJ"}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={handleLookup} disabled={loading} title="Buscar dados">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
