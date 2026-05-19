import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAtualizarFuncionario } from "@/hooks/useRH";
import { FuncionarioRH, TipoVinculo, TIPO_VINCULO_LABELS } from "@/types/rh";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: FuncionarioRH;
}

export function EditarFuncionarioDialog({ open, onOpenChange, funcionario }: Props) {
  const atualizar = useAtualizarFuncionario();
  const blank = {
    nome: funcionario.nome,
    cpf: funcionario.cpf ?? "",
    email: funcionario.email ?? "",
    telefone: funcionario.telefone ?? "",
    cargo: funcionario.cargo ?? "",
    tipo_vinculo: funcionario.tipo_vinculo,
    salario_reais: funcionario.salario_centavos ? (funcionario.salario_centavos / 100).toFixed(2) : "",
    vt_reais: funcionario.vt_centavos > 0 ? (funcionario.vt_centavos / 100).toFixed(2) : "",
    va_reais: funcionario.va_centavos > 0 ? (funcionario.va_centavos / 100).toFixed(2) : "",
    carga: funcionario.carga_horaria_semanal?.toString() ?? "",
    data_admissao: funcionario.data_admissao ?? "",
    endereco: funcionario.endereco ?? "",
    numero: funcionario.numero ?? "",
    complemento: funcionario.complemento ?? "",
    bairro: funcionario.bairro ?? "",
    cep: funcionario.cep ?? "",
    cidade: funcionario.cidade ?? "",
    estado: funcionario.estado ?? "",
    especialidade: funcionario.especialidade ?? "",
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) setForm(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funcionario]);

  const parseValor = (s: string): number | null => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? null : Math.round(n * 100);
  };

  const handleCepFound = (data: CepData) => {
    setForm((f) => ({
      ...f,
      endereco: data.logradouro || f.endereco,
      bairro: data.bairro || f.bairro,
      cidade: data.localidade || f.cidade,
      estado: data.uf || f.estado,
    }));
  };

  const handleSalvar = async () => {
    try {
      await atualizar.mutateAsync({
        id: funcionario.id,
        campos: {
          nome: form.nome,
          cpf: form.cpf || null,
          email: form.email || null,
          telefone: form.telefone || null,
          cargo: form.cargo || null,
          tipo_vinculo: form.tipo_vinculo,
          salario_centavos: parseValor(form.salario_reais),
          vt_centavos: parseValor(form.vt_reais) ?? 0,
          va_centavos: parseValor(form.va_reais) ?? 0,
          carga_horaria_semanal: form.carga ? parseFloat(form.carga) : null,
          data_admissao: form.data_admissao || null,
          endereco: form.endereco || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cep: form.cep || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
          especialidade: form.especialidade || null,
        } as any,
      });
      toast.success("Funcionário atualizado");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar funcionário</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pessoais" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pessoais">Dados pessoais</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="profissional">Profissional</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoais" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Especialidade</Label>
              <Input
                value={form.especialidade}
                onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                placeholder="Ex: Geral, iPhone, Samsung"
              />
            </div>
          </TabsContent>

          <TabsContent value="endereco" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <CepLookup
                cep={form.cep}
                onCepChange={(v) => setForm({ ...form, cep: v })}
                onAddressFound={handleCepFound}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, avenida, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="123" />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input
                value={form.complemento}
                onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                placeholder="Apto, bloco, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="profissional" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de vínculo</Label>
              <Select value={form.tipo_vinculo} onValueChange={(v) => setForm({ ...form, tipo_vinculo: v as TipoVinculo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_VINCULO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de admissão</Label>
              <Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Carga horária semanal (h)</Label>
              <Input type="number" value={form.carga} onChange={(e) => setForm({ ...form, carga: e.target.value })} placeholder="44" />
            </div>
            <div className="space-y-2">
              <Label>Salário mensal (R$)</Label>
              <Input value={form.salario_reais} onChange={(e) => setForm({ ...form, salario_reais: e.target.value })} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>VT mensal (R$)</Label>
              <Input value={form.vt_reais} onChange={(e) => setForm({ ...form, vt_reais: e.target.value })} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>VA mensal (R$)</Label>
              <Input value={form.va_reais} onChange={(e) => setForm({ ...form, va_reais: e.target.value })} placeholder="0,00" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={atualizar.isPending}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={atualizar.isPending}>
            {atualizar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
