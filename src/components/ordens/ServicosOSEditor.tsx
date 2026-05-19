import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type MotivoSemTecnico = "terceirizado" | "sem_atribuicao" | null;

export type ServicoOSPayload = {
  id?: string;
  servico_id: string;
  tecnico_id: string | null;
  valor: number;
  comissao: number;
  motivo_sem_tecnico?: MotivoSemTecnico;
  valor_terceirizado?: number;
};

type TipoServicoOption = { id: string; nome: string; valor_padrao?: number; comissao_padrao?: number; valor_mao_obra?: number };
type TecnicoOption = { id: string; nome: string };

type Props = {
  ordemId?: string;
  servicosIniciais: ServicoOSPayload[];
  tiposServico: TipoServicoOption[];
  tecnicos: TecnicoOption[];
  onChange?: (servicos: ServicoOSPayload[]) => void;
  onSave?: (resultado: any) => void;
  autoSave?: boolean;
  className?: string;
  custoPecas?: number;
  desconto?: number;
};

const SEM_TECNICO = "__sem_tecnico__";
const TERCEIRIZADO = "__terceirizado__";
const SEM_ATRIBUICAO = "__sem_atribuicao__";
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const norm = (value: unknown) => Number(value) || 0;
const sameList = (a: ServicoOSPayload[], b: ServicoOSPayload[]) => JSON.stringify(a.map(clean)) === JSON.stringify(b.map(clean));
const clean = (s: ServicoOSPayload): ServicoOSPayload => ({
  id: s.id ?? null,
  servico_id: s.servico_id,
  tecnico_id: s.tecnico_id ?? null,
  motivo_sem_tecnico: s.motivo_sem_tecnico ?? null,
  valor_terceirizado: norm(s.valor_terceirizado),
  valor: norm(s.valor),
  comissao: norm(s.comissao),
} as ServicoOSPayload);

function TipoServicoCombobox({ value, onValueChange, tiposServico }: { value: string; onValueChange: (v: string) => void; tiposServico: TipoServicoOption[] }) {
  const [open, setOpen] = useState(false);
  const selected = tiposServico.find((t) => t.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="h-9 w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.nome || "Selecione"}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar serviço..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum serviço encontrado</CommandEmpty>
            <CommandGroup>
              {tiposServico.map((tipo) => (
                <CommandItem key={tipo.id} value={tipo.nome} onSelect={() => { onValueChange(tipo.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === tipo.id ? "opacity-100" : "opacity-0")} />
                  {tipo.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ServicosOSEditor({ ordemId, servicosIniciais, tiposServico, tecnicos, onChange, onSave, autoSave = true, className, custoPecas, desconto }: Props) {
  const queryClient = useQueryClient();
  const [servicos, setServicos] = useState<ServicoOSPayload[]>(() => servicosIniciais.map(clean));
  const [openAdd, setOpenAdd] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const [novo, setNovo] = useState<ServicoOSPayload>({ servico_id: "", tecnico_id: null, valor: 0, comissao: 0, motivo_sem_tecnico: null, valor_terceirizado: 0 });

  useEffect(() => setServicos(servicosIniciais.map(clean)), [servicosIniciais]);

  function updateServicos(next: ServicoOSPayload[]) {
    setServicos(next);
    onChange?.(next);
  }

  const totalValor = useMemo(() => servicos.reduce((sum, s) => sum + norm(s.valor), 0), [servicos]);
  const totalComissao = useMemo(() => servicos.reduce((sum, s) => sum + norm(s.comissao), 0), [servicos]);
  const totalTerceirizado = useMemo(
    () => servicos.reduce((sum, s) => sum + (s.motivo_sem_tecnico === "terceirizado" ? norm(s.valor_terceirizado) : 0), 0),
    [servicos],
  );
  const lucro = totalValor - norm(desconto) - norm(custoPecas) - totalComissao - totalTerceirizado;
  const dirty = !sameList(servicos, servicosIniciais);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!ordemId) return { success: true, total_valor: totalValor, total_comissao: totalComissao };
      // Valida terceirizado tem valor antes de enviar
      const invalido = servicos.find((s) => s.motivo_sem_tecnico === "terceirizado" && norm(s.valor_terceirizado) <= 0);
      if (invalido) throw new Error("Serviço terceirizado precisa de custo > 0");

      const { data, error } = await supabase.rpc("editar_os_servicos_v2" as any, {
        p_ordem_id: ordemId,
        p_servicos: servicos.map(clean),
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error || "Erro ao salvar serviços");
      return data;
    },
    onSuccess: (data) => {
      toast.success("Serviços atualizados");
      queryClient.invalidateQueries({ queryKey: ["ordem", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["os-servicos", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["os-servicos-v2", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["comissoes_os", ordemId] });
      queryClient.invalidateQueries({ queryKey: ["os-pendente-atribuicao"] });
      onSave?.(data);
    },
    onError: (error: any) => toast.error(error.message || "Erro ao salvar serviços"),
  });

  function patchRow(index: number, patch: Partial<ServicoOSPayload>) {
    updateServicos(servicos.map((item, i) => i === index ? clean({ ...item, ...patch }) : item));
  }

  function applyTipo(current: ServicoOSPayload, servicoId: string) {
    const tipo = tiposServico.find((t) => t.id === servicoId);
    return clean({
      ...current,
      servico_id: servicoId,
      valor: current.valor > 0 ? current.valor : norm(tipo?.valor_padrao ?? tipo?.valor_mao_obra),
      comissao: current.comissao > 0 ? current.comissao : norm(tipo?.comissao_padrao),
    });
  }

  function addNovo() {
    if (!novo.servico_id) {
      toast.error("Selecione o tipo de serviço");
      return;
    }
    if (novo.motivo_sem_tecnico === "terceirizado" && norm(novo.valor_terceirizado) <= 0) {
      toast.error("Informe o custo do terceirizado");
      return;
    }
    updateServicos([...servicos, clean(novo)]);
    setNovo({ servico_id: "", tecnico_id: null, valor: 0, comissao: 0, motivo_sem_tecnico: null, valor_terceirizado: 0 });
    setOpenAdd(false);
    toast.success("Serviço adicionado");
  }

  function removePending() {
    if (pendingRemove === null) return;
    updateServicos(servicos.filter((_, index) => index !== pendingRemove));
    setPendingRemove(null);
    toast.success("Serviço removido");
  }

  const renderTipoSelect = (value: string, onValueChange: (value: string) => void) => (
    <TipoServicoCombobox value={value} onValueChange={onValueChange} tiposServico={tiposServico} />
  );

  function currentTecnicoValue(linha: ServicoOSPayload): string {
    if (linha.tecnico_id) return linha.tecnico_id;
    if (linha.motivo_sem_tecnico === "terceirizado") return TERCEIRIZADO;
    if (linha.motivo_sem_tecnico === "sem_atribuicao") return SEM_ATRIBUICAO;
    return SEM_TECNICO;
  }

  function handleTecnicoChange(linha: ServicoOSPayload, value: string, onUpdate: (patch: Partial<ServicoOSPayload>) => void) {
    if (value === TERCEIRIZADO) {
      onUpdate({ tecnico_id: null, motivo_sem_tecnico: "terceirizado" });
    } else if (value === SEM_ATRIBUICAO) {
      onUpdate({ tecnico_id: null, motivo_sem_tecnico: "sem_atribuicao", valor_terceirizado: 0 });
    } else if (value === SEM_TECNICO) {
      onUpdate({ tecnico_id: null, motivo_sem_tecnico: null, valor_terceirizado: 0 });
    } else {
      onUpdate({ tecnico_id: value, motivo_sem_tecnico: null, valor_terceirizado: 0 });
    }
  }

  const renderTecnicoSelect = (linha: ServicoOSPayload, onUpdate: (patch: Partial<ServicoOSPayload>) => void) => (
    <Select value={currentTecnicoValue(linha)} onValueChange={(v) => handleTecnicoChange(linha, v, onUpdate)}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Atribuir técnico..." /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Técnicos da equipe</SelectLabel>
          {tecnicos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          {tecnicos.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum técnico cadastrado</div>
          )}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Sem técnico</SelectLabel>
          <SelectItem value={TERCEIRIZADO}>🤝 Terceirizado (com custo)</SelectItem>
          <SelectItem value={SEM_ATRIBUICAO}>— Sem atribuição</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Serviço</th>
              <th className="px-3 py-2 text-left font-medium">Técnico responsável</th>
              <th className="px-3 py-2 text-left font-medium w-28">Valor</th>
              <th className="px-3 py-2 text-left font-medium w-28">Comissão</th>
              <th className="px-3 py-2 text-left font-medium w-32">Custo terc.</th>
              <th className="px-3 py-2 text-right font-medium w-16">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {servicos.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum serviço executado.</td></tr>
            ) : servicos.map((servico, index) => (
              <tr key={`${servico.id ?? "novo"}-${index}`}>
                <td className="px-3 py-2">{renderTipoSelect(servico.servico_id, (value) => patchRow(index, applyTipo(servico, value)))}</td>
                <td className="px-3 py-2">{renderTecnicoSelect(servico, (patch) => patchRow(index, patch))}</td>
                <td className="px-3 py-2"><Input className="h-9" type="number" min="0" step="0.01" value={servico.valor} onChange={(e) => patchRow(index, { valor: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Input className="h-9" type="number" min="0" step="0.01" value={servico.comissao} onChange={(e) => patchRow(index, { comissao: Number(e.target.value) })} /></td>
                <td className="px-3 py-2">
                  {servico.motivo_sem_tecnico === "terceirizado" ? (
                    <Input
                      className="h-9"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={servico.valor_terceirizado || ""}
                      onChange={(e) => patchRow(index, { valor_terceirizado: Number(e.target.value) || 0 })}
                      placeholder="0,00"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPendingRemove(index)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => setOpenAdd(true)}>
        <Plus className="h-4 w-4" />Adicionar serviço
      </Button>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Valor total</p><p className="text-sm font-semibold">{money(totalValor)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Comissões {totalTerceirizado > 0 ? "+ terc." : ""}</p><p className="text-sm font-semibold">{money(totalComissao + totalTerceirizado)}</p></CardContent></Card>
        <Card className="border-success/30 bg-success/5"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Lucro estimado</p><p className="text-sm font-semibold text-success">{money(lucro)}</p></CardContent></Card>
      </div>

      {autoSave && dirty && (
        <Button type="button" className="w-full" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          <Save className="h-4 w-4" />Salvar alterações
        </Button>
      )}

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar serviço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo de serviço</Label>{renderTipoSelect(novo.servico_id, (value) => setNovo(applyTipo(novo, value)))}</div>
            <div><Label>Técnico</Label>{renderTecnicoSelect(novo, (patch) => setNovo((prev) => clean({ ...prev, ...patch })))}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor</Label><Input type="number" min="0" step="0.01" value={novo.valor} onChange={(e) => setNovo((prev) => clean({ ...prev, valor: Number(e.target.value) }))} /></div>
              <div><Label>Comissão</Label><Input type="number" min="0" step="0.01" value={novo.comissao} onChange={(e) => setNovo((prev) => clean({ ...prev, comissao: Number(e.target.value) }))} /></div>
            </div>
            {novo.motivo_sem_tecnico === "terceirizado" && (
              <div>
                <Label>Custo terceirizado</Label>
                <Input type="number" min="0.01" step="0.01" value={novo.valor_terceirizado || ""} onChange={(e) => setNovo((prev) => clean({ ...prev, valor_terceirizado: Number(e.target.value) || 0 }))} placeholder="0,00" />
              </div>
            )}
          </div>
          <DialogFooter><Button type="button" onClick={addNovo}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este serviço?</AlertDialogTitle>
            <AlertDialogDescription>A comissão vinculada será estornada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removePending}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
