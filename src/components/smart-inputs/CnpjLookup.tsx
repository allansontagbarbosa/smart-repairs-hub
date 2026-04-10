import { useState, useCallback, useMemo } from "react";
import { Loader2, Search, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaskedInput, unMask } from "./MaskedInput";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Validation helpers ──

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // all same digit

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(digits[12]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(digits[13]) === d2;
}

// ── Types ──

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
}

// ── Component ──

export function CnpjLookup({ value, onValueChange, onDataFound, label = "CPF / CNPJ" }: CnpjLookupProps) {
  const [loading, setLoading] = useState(false);

  const digits = useMemo(() => unMask(value), [value]);

  const validation = useMemo(() => {
    if (digits.length === 0) return { status: "empty" as const };
    if (digits.length < 11) return { status: "typing" as const };
    if (digits.length === 11) {
      return validateCpf(digits)
        ? { status: "valid" as const, type: "cpf" as const }
        : { status: "invalid" as const, message: "CPF inválido" };
    }
    if (digits.length < 14) return { status: "typing" as const };
    return validateCnpj(digits)
      ? { status: "valid" as const, type: "cnpj" as const }
      : { status: "invalid" as const, message: "CNPJ inválido" };
  }, [digits]);

  const canLookup = validation.status === "valid" && validation.type === "cnpj";

  const handleLookup = useCallback(async () => {
    if (validation.status === "valid" && validation.type === "cpf") {
      toast.success("CPF válido!");
      return;
    }
    if (!canLookup) {
      toast.error("Informe um CNPJ válido para consulta");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) { toast.error("CNPJ não encontrado na Receita Federal"); return; }
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
  }, [digits, validation, canLookup, onDataFound]);

  const borderClass =
    validation.status === "valid" ? "ring-2 ring-green-500/40" :
    validation.status === "invalid" ? "ring-2 ring-destructive/40" : "";

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <div className={cn("relative flex-1 rounded-md", borderClass)}>
          <MaskedInput
            mask="cpf_cnpj"
            value={value}
            onValueChange={(_, masked) => onValueChange(masked)}
            placeholder="Digite CPF ou CNPJ"
            className="pr-8"
          />
          {validation.status === "valid" && (
            <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
          {validation.status === "invalid" && (
            <XCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleLookup}
          disabled={loading || (validation.status !== "valid")}
          title={canLookup ? "Buscar dados na Receita Federal" : "Validar documento"}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {validation.status === "invalid" && (
        <p className="text-xs text-destructive mt-1">{validation.message}</p>
      )}
      {validation.status === "valid" && (
        <p className="text-xs text-green-600 mt-1">
          {validation.type === "cpf" ? "CPF válido" : "CNPJ válido — clique na lupa para buscar dados"}
        </p>
      )}
    </div>
  );
}
