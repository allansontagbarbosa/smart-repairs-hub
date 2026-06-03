import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAtualizarFuncionario } from "@/hooks/useRH";
import { useDependentes, useSalvarDependente, useRemoverDependente, type Dependente } from "@/hooks/useDependentes";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { FuncionarioRH, TipoVinculo, TIPO_VINCULO_LABELS } from "@/types/rh";
import { isValidCpf, onlyDigits } from "@/lib/cpfCnpj";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: FuncionarioRH;
}

const ESTADO_CIVIL = ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel", "separado"];
const GENERO = ["masculino", "feminino", "outro", "nao_informar"];
const TIPO_CONTA = ["corrente", "poupanca", "salario"];
const PIX_TIPO = ["cpf", "email", "telefone", "aleatoria"];
const PARENTESCO = ["filho", "filha", "conjuge", "companheiro(a)", "enteado(a)", "pai", "mae", "outro"];

export function EditarFuncionarioDialog({ open, onOpenChange, funcionario }: Props) {
  const f: any = funcionario;
  const atualizar = useAtualizarFuncionario();
  const { empresaId } = useEmpresa();

  const blank = {
    // pessoais
    nome: f.nome,
    cpf: f.cpf ?? "",
    rg: f.rg ?? "",
    email: f.email ?? "",
    telefone: f.telefone ?? "",
    data_nascimento: f.data_nascimento ?? "",
    estado_civil: f.estado_civil ?? "",
    genero: f.genero ?? "",
    nome_mae: f.nome_mae ?? "",
    // documentos
    pis_pasep: f.pis_pasep ?? "",
    ctps_numero: f.ctps_numero ?? "",
    ctps_serie: f.ctps_serie ?? "",
    ctps_uf: f.ctps_uf ?? "",
    cbo: f.cbo ?? "",
    // endereço
    endereco: f.endereco ?? "",
    numero: f.numero ?? "",
    complemento: f.complemento ?? "",
    bairro: f.bairro ?? "",
    cep: f.cep ?? "",
    cidade: f.cidade ?? "",
    estado: f.estado ?? "",
    // profissional
    cargo: f.cargo ?? "",
    especialidade: f.especialidade ?? "",
    tipo_vinculo: f.tipo_vinculo,
    salario_reais: f.salario_centavos ? (f.salario_centavos / 100).toFixed(2) : "",
    vt_reais: f.vt_centavos > 0 ? (f.vt_centavos / 100).toFixed(2) : "",
    va_reais: f.va_centavos > 0 ? (f.va_centavos / 100).toFixed(2) : "",
    carga: f.carga_horaria_semanal?.toString() ?? "",
    data_admissao: f.data_admissao ?? "",
    data_demissao: f.data_demissao ?? "",
    centro_custo: f.centro_custo ?? "",
    // pagamento
    banco: f.banco ?? "",
    agencia: f.agencia ?? "",
    conta_bancaria: f.conta_bancaria ?? "",
    tipo_conta: f.tipo_conta ?? "",
    pix_tipo: f.pix_tipo ?? "",
    chave_pix: f.chave_pix ?? "",
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

  // Validações (não bloqueiam)
  const cpfDig = onlyDigits(form.cpf);
  const cpfWarn = form.cpf && (cpfDig.length !== 11 || !isValidCpf(cpfDig));
  const pisDig = onlyDigits(form.pis_pasep);
  const pisWarn = form.pis_pasep && pisDig.length !== 11;
  const datasOk = (() => {
    if (form.data_nascimento && form.data_admissao && form.data_nascimento >= form.data_admissao) return false;
    if (form.data_admissao && form.data_demissao && form.data_admissao > form.data_demissao) return false;
    return true;
  })();

  // Completude
  const faltando: string[] = [];
  if (!form.cpf) faltando.push("CPF");
  if (!form.pis_pasep) faltando.push("PIS/PASEP");
  if (!form.data_admissao) faltando.push("Admissão");
  if (!form.salario_reais) faltando.push("Salário");
  if (!form.chave_pix && !form.conta_bancaria) faltando.push("Conta/PIX");

  const handleSalvar = async () => {
    if (!datasOk) {
      toast.error("Datas incoerentes (nascimento < admissão < demissão).");
      return;
    }
    try {
      await atualizar.mutateAsync({
        id: funcionario.id,
        campos: {
          nome: form.nome,
          cpf: form.cpf ? cpfDig : null,
          rg: form.rg || null,
          email: form.email || null,
          telefone: form.telefone || null,
          data_nascimento: form.data_nascimento || null,
          estado_civil: form.estado_civil || null,
          genero: form.genero || null,
          nome_mae: form.nome_mae || null,
          pis_pasep: form.pis_pasep ? pisDig : null,
          ctps_numero: form.ctps_numero || null,
          ctps_serie: form.ctps_serie || null,
          ctps_uf: form.ctps_uf || null,
          cbo: form.cbo || null,
          cargo: form.cargo || null,
          especialidade: form.especialidade || null,
          tipo_vinculo: form.tipo_vinculo,
          salario_centavos: parseValor(form.salario_reais),
          vt_centavos: parseValor(form.vt_reais) ?? 0,
          va_centavos: parseValor(form.va_reais) ?? 0,
          carga_horaria_semanal: form.carga ? parseFloat(form.carga) : null,
          data_admissao: form.data_admissao || null,
          data_demissao: form.data_demissao || null,
          centro_custo: form.centro_custo || null,
          banco: form.banco || null,
          agencia: form.agencia || null,
          conta_bancaria: form.conta_bancaria || null,
          tipo_conta: form.tipo_conta || null,
          pix_tipo: form.pix_tipo || null,
          chave_pix: form.chave_pix || null,
          endereco: form.endereco || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cep: form.cep || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar funcionário</DialogTitle>
        </DialogHeader>

        {faltando.length > 0 && (
          <div className="text-xs flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-2 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Faltando para folha completa: <strong>{faltando.join(", ")}</strong></span>
          </div>
        )}

        <Tabs defaultValue="pessoais" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="pessoais">Pessoais</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="profissional">Profissional</TabsTrigger>
            <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
            <TabsTrigger value="dependentes">Dependentes</TabsTrigger>
          </TabsList>

          {/* PESSOAIS */}
          <TabsContent value="pessoais" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              {cpfWarn && <p className="text-[11px] text-amber-600">CPF inválido</p>}
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado civil</Label>
              <Select value={form.estado_civil} onValueChange={(v) => setForm({ ...form, estado_civil: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {ESTADO_CIVIL.map(v => <SelectItem key={v} value={v}>{v.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={form.genero} onValueChange={(v) => setForm({ ...form, genero: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {GENERO.map(v => <SelectItem key={v} value={v}>{v.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nome da mãe</Label>
              <Input value={form.nome_mae} onChange={(e) => setForm({ ...form, nome_mae: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </TabsContent>

          {/* DOCUMENTOS */}
          <TabsContent value="documentos" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>PIS/PASEP/NIT</Label>
              <Input value={form.pis_pasep} onChange={(e) => setForm({ ...form, pis_pasep: e.target.value })} placeholder="11 dígitos" />
              {pisWarn && <p className="text-[11px] text-amber-600">PIS deve ter 11 dígitos</p>}
            </div>
            <div className="space-y-2">
              <Label>CBO (código do cargo)</Label>
              <Input value={form.cbo} onChange={(e) => setForm({ ...form, cbo: e.target.value })} placeholder="Ex: 7156-10" />
            </div>
            <div className="space-y-2">
              <Label>CTPS número</Label>
              <Input value={form.ctps_numero} onChange={(e) => setForm({ ...form, ctps_numero: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CTPS série</Label>
              <Input value={form.ctps_serie} onChange={(e) => setForm({ ...form, ctps_serie: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CTPS UF</Label>
              <Input value={form.ctps_uf} onChange={(e) => setForm({ ...form, ctps_uf: e.target.value.toUpperCase() })} maxLength={2} placeholder="SP" />
            </div>
          </TabsContent>

          {/* ENDEREÇO */}
          <TabsContent value="endereco" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <CepLookup cep={form.cep} onCepChange={(v) => setForm({ ...form, cep: v })} onAddressFound={handleCepFound} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
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
              <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
            </div>
          </TabsContent>

          {/* PROFISSIONAL */}
          <TabsContent value="profissional" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Input value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
            </div>
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
              <Label>Centro de custo</Label>
              <Input value={form.centro_custo} onChange={(e) => setForm({ ...form, centro_custo: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Data de admissão</Label>
              <Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de demissão</Label>
              <Input type="date" value={form.data_demissao} onChange={(e) => setForm({ ...form, data_demissao: e.target.value })} />
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
            {!datasOk && <p className="md:col-span-2 text-xs text-destructive">Datas incoerentes: nascimento &lt; admissão &lt; demissão.</p>}
          </TabsContent>

          {/* PAGAMENTO */}
          <TabsContent value="pagamento" className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2 text-xs text-muted-foreground">
              Dados bancários ou PIX usados para pagamento de salário e exibidos no holerite.
            </div>
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ex: 341 - Itaú" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de conta</Label>
              <Select value={form.tipo_conta} onValueChange={(v) => setForm({ ...form, tipo_conta: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {TIPO_CONTA.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agência</Label>
              <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Input value={form.conta_bancaria} onChange={(e) => setForm({ ...form, conta_bancaria: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de chave PIX</Label>
              <Select value={form.pix_tipo} onValueChange={(v) => setForm({ ...form, pix_tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {PIX_TIPO.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} />
            </div>
          </TabsContent>

          {/* DEPENDENTES */}
          <TabsContent value="dependentes" className="py-2">
            <DependentesTab funcionarioId={funcionario.id} empresaId={empresaId} />
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

function DependentesTab({ funcionarioId, empresaId }: { funcionarioId: string; empresaId: string | null }) {
  const { data: deps = [], isLoading } = useDependentes(funcionarioId);
  const salvar = useSalvarDependente();
  const remover = useRemoverDependente();
  const [novo, setNovo] = useState<Partial<Dependente>>({
    nome: "", parentesco: "", data_nascimento: "", cpf: "", conta_irrf: true, conta_salario_familia: false,
  });

  const handleAdd = async () => {
    if (!novo.nome || !empresaId) {
      toast.error("Nome do dependente obrigatório.");
      return;
    }
    try {
      await salvar.mutateAsync({
        funcionario_id: funcionarioId,
        empresa_id: empresaId,
        nome: novo.nome!,
        parentesco: novo.parentesco || null,
        data_nascimento: novo.data_nascimento || null,
        cpf: novo.cpf ? onlyDigits(novo.cpf) : null,
        conta_irrf: !!novo.conta_irrf,
        conta_salario_familia: !!novo.conta_salario_familia,
      });
      setNovo({ nome: "", parentesco: "", data_nascimento: "", cpf: "", conta_irrf: true, conta_salario_familia: false });
      toast.success("Dependente adicionado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (d: Dependente, campo: "conta_irrf" | "conta_salario_familia") => {
    try {
      await salvar.mutateAsync({
        id: d.id, funcionario_id: funcionarioId, empresa_id: empresaId!,
        nome: d.nome, data_nascimento: d.data_nascimento, parentesco: d.parentesco, cpf: d.cpf,
        conta_irrf: campo === "conta_irrf" ? !d.conta_irrf : d.conta_irrf,
        conta_salario_familia: campo === "conta_salario_familia" ? !d.conta_salario_familia : d.conta_salario_familia,
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemove = async (d: Dependente) => {
    if (!confirm(`Remover ${d.nome}?`)) return;
    await remover.mutateAsync({ id: d.id, funcionario_id: funcionarioId });
    toast.success("Removido");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Dependentes alimentam IRRF e salário-família futuros. Marque os flags adequadamente.
      </p>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : deps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum dependente cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {deps.map(d => (
            <div key={d.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-md text-sm">
              <div className="col-span-3 font-medium truncate">{d.nome}</div>
              <div className="col-span-2 text-xs text-muted-foreground">{d.parentesco || "—"}</div>
              <div className="col-span-2 text-xs text-muted-foreground">{d.data_nascimento || "—"}</div>
              <label className="col-span-2 flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={d.conta_irrf} onChange={() => handleToggle(d, "conta_irrf")} /> IRRF
              </label>
              <label className="col-span-2 flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={d.conta_salario_familia} onChange={() => handleToggle(d, "conta_salario_familia")} /> Sal.-Família
              </label>
              <Button size="icon" variant="ghost" className="col-span-1 h-7 w-7" onClick={() => handleRemove(d)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-medium">Adicionar dependente</p>
        <div className="grid grid-cols-12 gap-2">
          <Input className="col-span-4" placeholder="Nome" value={novo.nome ?? ""} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <Select value={novo.parentesco ?? ""} onValueChange={(v) => setNovo({ ...novo, parentesco: v })}>
            <SelectTrigger className="col-span-3"><SelectValue placeholder="Parentesco" /></SelectTrigger>
            <SelectContent>
              {PARENTESCO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="col-span-3" type="date" value={novo.data_nascimento ?? ""} onChange={(e) => setNovo({ ...novo, data_nascimento: e.target.value })} />
          <Input className="col-span-2" placeholder="CPF" value={novo.cpf ?? ""} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={!!novo.conta_irrf} onChange={(e) => setNovo({ ...novo, conta_irrf: e.target.checked })} /> Conta para IRRF
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={!!novo.conta_salario_familia} onChange={(e) => setNovo({ ...novo, conta_salario_familia: e.target.checked })} /> Conta para salário-família
          </label>
          <Button size="sm" onClick={handleAdd} disabled={salvar.isPending} className="ml-auto">
            {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
