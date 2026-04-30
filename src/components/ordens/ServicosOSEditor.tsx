import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ServicoOSPayload = {
  id?: string;
  servico_id: string;
  tecnico_id: string | null;
  valor: number;
  comissao: number;
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
  /**
   * Custo das peças usadas na OS. Quando fornecido, é descontado do lucro estimado
   * para alinhar com o cálculo da sidebar/detalhes da OS (peça é custo, não receita).
   */
  custoPecas?: number;
  /**
   * Desconto aplicado ao total ao cliente. Quando fornecido, é descontado do lucro
   * estimado para refletir a receita real da OS.
   */
  desconto?: number;
};

const SEM_TECNICO = "__sem_tecnico__";
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const norm = (value: unknown) => Number(value) || 0;
const sameList = (a: ServicoOSPayload[], b: ServicoOSPayload[]) => JSON.stringify(a.map(clean)) === JSON.stringify(b.map(clean));
const clean = (s: ServicoOSPayload) => ({ id: s.id ?? null, servico_id: s.servico_id, tecnico_id: s.tecnico_id ?? null, valor: norm(s.valor), comissao: norm(s.comissao) });

export function ServicosOSEditor({ ordemId, servicosIniciais, tiposServico, tecnicos, onChange, onSave, autoSave = true, className, custoPecas, desconto }: Props) {
  const queryClient = useQueryClient();
  const [servicos, setServicos] = useState<ServicoOSPayload[]>(() => servicosIniciais.map(clean));
  const [openAdd, setOpenAdd] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const [novo, setNovo] = useState<ServicoOSPayload>({ servico_id: "", tecnico_id: null, valor: 0, comissao: 0 });

  useEffect(() => setServicos(servicosIniciais.map(clean)), [servicosIniciais]);

  function updateServicos(next: ServicoOSPayload[]) {
    setServicos(next);
    onChange?.(next);
  }

  const totalValor = useMemo(() => servicos.reduce((sum, s) => sum + norm(s.valor), 0), [servicos]);
  const totalComissao = useMemo(() => servicos.reduce((sum, s) => sum + norm(s.comissao), 0), [servicos]);
  // Lucro estimado: usa a mesma fórmula da sidebar/detalhes da OS quando peças e desconto
  // são fornecidos (valor − desconto − peças − comissão). Caso contrário, fallback ao
  // cálculo legacy (valor − comissão) para compatibilidade com chamadores antigos.
  const lucro = totalValor - norm(desconto) - norm(custoPecas) - totalComissao;
  const dirty = !sameList(servicos, servicosIniciais);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!ordemId) return { success: true, total_valor: totalValor, total_comissao: totalComissao };
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
    updateServicos([...servicos, clean(novo)]);
    setNovo({ servico_id: "", tecnico_id: null, valor: 0, comissao: 0 });
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
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent>
        {tiposServico.map((tipo) => <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const renderTecnicoSelect = (value: string | null, onValueChange: (value: string | null) => void) => (
    <Select value={value || SEM_TECNICO} onValueChange={(value) => onValueChange(value === SEM_TECNICO ? null : value)}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Sem técnico" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_TECNICO}>Sem técnico</SelectItem>
        {tecnicos.map((tecnico) => <SelectItem key={tecnico.id} value={tecnico.id}>{tecnico.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Serviço</th>
              <th className="px-3 py-2 text-left font-medium">Técnico responsável</th>
              <th className="px-3 py-2 text-left font-medium w-28">Valor</th>
              <th className="px-3 py-2 text-left font-medium w-28">Comissão</th>
              <th className="px-3 py-2 text-right font-medium w-16">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {servicos.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum serviço executado.</td></tr>
            ) : servicos.map((servico, index) => (
              <tr key={`${servico.id ?? "novo"}-${index}`}>
                <td className="px-3 py-2">{renderTipoSelect(servico.servico_id, (value) => patchRow(index, applyTipo(servico, value)))}</td>
                <td className="px-3 py-2">{renderTecnicoSelect(servico.tecnico_id, (value) => patchRow(index, { tecnico_id: value }))}</td>
                <td className="px-3 py-2"><Input className="h-9" type="number" min="0" step="0.01" value={servico.valor} onChange={(e) => patchRow(index, { valor: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Input className="h-9" type="number" min="0" step="0.01" value={servico.comissao} onChange={(e) => patchRow(index, { comissao: Number(e.target.value) })} /></td>
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
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Comissões</p><p className="text-sm font-semibold">{money(totalComissao)}</p></CardContent></Card>
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
            <div><Label>Técnico</Label>{renderTecnicoSelect(novo.tecnico_id, (value) => setNovo((prev) => clean({ ...prev, tecnico_id: value })))}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor</Label><Input type="number" min="0" step="0.01" value={novo.valor} onChange={(e) => setNovo((prev) => clean({ ...prev, valor: Number(e.target.value) }))} /></div>
              <div><Label>Comissão</Label><Input type="number" min="0" step="0.01" value={novo.comissao} onChange={(e) => setNovo((prev) => clean({ ...prev, comissao: Number(e.target.value) }))} /></div>
            </div>
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
