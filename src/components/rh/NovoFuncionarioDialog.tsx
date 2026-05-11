import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useCriarFuncionarioRH } from "@/hooks/useRH";
import { TipoVinculo, TIPO_VINCULO_LABELS } from "@/types/rh";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado?: (funcionarioId: string) => void;
}

const initialForm = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  cargo: "",
  tipo_vinculo: "clt" as TipoVinculo,
  salario: "",
  vt: "",
  va: "",
  carga: "",
  diaria: "",
  data_admissao: new Date().toISOString().slice(0, 10),
};

export function NovoFuncionarioDialog({ open, onOpenChange, onCriado }: Props) {
  const criar = useCriarFuncionarioRH();
  const [form, setForm] = useState(initialForm);

  const parseValor = (s: string): number | null => {
    if (!s) return null;
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? null : Math.round(n * 100);
  };

  const handleCriar = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      const r = await criar.mutateAsync({
        nome: form.nome.trim(),
        cpf: form.cpf || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        cargo: form.cargo || undefined,
        tipo_vinculo: form.tipo_vinculo,
        salario_centavos: parseValor(form.salario) ?? undefined,
        vt_centavos: parseValor(form.vt) ?? 0,
        va_centavos: parseValor(form.va) ?? 0,
        carga_horaria_semanal: form.carga ? parseFloat(form.carga) : undefined,
        data_admissao: form.data_admissao || undefined,
        valor_diaria_centavos: parseValor(form.diaria) ?? undefined,
      });
      toast.success(`${form.nome} cadastrado com sucesso!`);
      onCriado?.(r.funcionario_id);
      onOpenChange(false);
      setForm(initialForm);
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar");
    }
  };

  const isDiarista = form.tipo_vinculo === "diarista";
  const isCLT = form.tipo_vinculo === "clt";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Novo funcionário
          </DialogTitle>
          <DialogDescription>
            Cadastra um funcionário diretamente no RH (sem precisar criar conta de login).
            Útil pra diaristas, PJs e freelancers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Nome completo *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="João da Silva"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de vínculo *</Label>
            <Select
              value={form.tipo_vinculo}
              onValueChange={(v: string) => setForm({ ...form, tipo_vinculo: v as TipoVinculo })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_VINCULO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              placeholder="Técnico, Auxiliar, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de admissão</Label>
            <Input
              type="date"
              value={form.data_admissao}
              onChange={(e) => setForm({ ...form, data_admissao: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Carga horária semanal</Label>
            <Input
              type="number"
              value={form.carga}
              onChange={(e) => setForm({ ...form, carga: e.target.value })}
              placeholder={isDiarista ? "Opcional p/ diarista" : "44"}
            />
          </div>

          {!isDiarista && (
            <div className="space-y-2">
              <Label>Salário mensal (R$)</Label>
              <Input
                value={form.salario}
                onChange={(e) => setForm({ ...form, salario: e.target.value })}
                placeholder="0,00"
              />
            </div>
          )}

          {isDiarista && (
            <div className="space-y-2">
              <Label>Valor da diária (R$)</Label>
              <Input
                value={form.diaria}
                onChange={(e) => setForm({ ...form, diaria: e.target.value })}
                placeholder="0,00"
              />
            </div>
          )}

          {isCLT && (
            <>
              <div className="space-y-2">
                <Label>VT mensal (R$)</Label>
                <Input
                  value={form.vt}
                  onChange={(e) => setForm({ ...form, vt: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>VA mensal (R$)</Label>
                <Input
                  value={form.va}
                  onChange={(e) => setForm({ ...form, va: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={criar.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleCriar} disabled={criar.isPending}>
            {criar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
