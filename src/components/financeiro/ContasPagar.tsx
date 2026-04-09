import { useState } from "react";
import { Plus, Search, Check, Copy, Trash2, Edit2, RotateCcw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NovaContaDialog } from "./NovaContaDialog";
import type { ContaPagar } from "@/hooks/useFinanceiro";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d + "T12:00:00"), "dd/MM/yyyy");

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  paga: { label: "Paga", color: "bg-success text-success-foreground" },
  vencida: { label: "Vencida", color: "bg-destructive text-destructive-foreground" },
  cancelada: { label: "Cancelada", color: "bg-muted text-muted-foreground" },
};

interface Props {
  contas: ContaPagar[];
  categorias: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
}

export function ContasPagar({ contas, categorias, centros }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null);
  const queryClient = useQueryClient();

  // Mark overdue
  const contasProcessadas = contas.map(c => {
    if (c.status === "pendente" && new Date(c.data_vencimento + "T23:59:59") < new Date()) {
      return { ...c, status: "vencida" as const };
    }
    return c;
  });

  const filtered = contasProcessadas.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search || c.descricao.toLowerCase().includes(q) || (c.fornecedor?.toLowerCase().includes(q));
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const matchCat = filterCategoria === "todas" || c.categoria === filterCategoria;
    return matchSearch && matchStatus && matchCat;
  });

  const pagarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contas_a_pagar")
        .update({ status: "paga" as any, data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta marcada como paga!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_a_pagar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta removida!");
    },
  });

  const duplicarMutation = useMutation({
    mutationFn: async (conta: ContaPagar) => {
      const nextMonth = new Date(conta.data_vencimento + "T12:00:00");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const { error } = await supabase.from("contas_a_pagar").insert({
        descricao: conta.descricao,
        categoria: conta.categoria,
        categoria_financeira_id: conta.categoria_financeira_id,
        centro_custo: conta.centro_custo,
        centro_custo_id: conta.centro_custo_id,
        fornecedor: conta.fornecedor,
        valor: conta.valor,
        data_vencimento: nextMonth.toISOString().split("T")[0],
        recorrente: conta.recorrente,
        observacoes: conta.observacoes,
        status: "pendente" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta duplicada para o próximo mês!");
    },
  });

  const uniqueCategories = [...new Set(contas.map(c => c.categoria))].sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar descrição ou fornecedor..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={() => { setEditingConta(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Nova Conta
        </Button>
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th className="hidden sm:table-cell">Categoria</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cfg = statusConfig[c.status] ?? statusConfig.pendente;
                const isVencida = c.status === "vencida";
                return (
                  <tr key={c.id} className={isVencida ? "bg-destructive/5" : ""}>
                    <td>
                      <p className="text-sm font-medium">{c.descricao}</p>
                      {c.fornecedor && <p className="text-xs text-muted-foreground">{c.fornecedor}</p>}
                      {c.recorrente && <span className="inline-flex items-center gap-1 text-[10px] text-info font-medium"><RotateCcw className="h-2.5 w-2.5" />Recorrente</span>}
                    </td>
                    <td className="hidden sm:table-cell text-sm text-muted-foreground">{c.categoria}</td>
                    <td className={`text-sm ${isVencida ? "text-destructive font-medium" : ""}`}>{fmtDate(c.data_vencimento)}</td>
                    <td className="text-sm font-medium">{fmtCurrency(c.valor)}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        {c.status !== "paga" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Marcar como paga" onClick={() => pagarMutation.mutate(c.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => { setEditingConta(c); setDialogOpen(true); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-info" title="Duplicar próximo mês" onClick={() => duplicarMutation.mutate(c)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">Nenhuma conta encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NovaContaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingConta={editingConta}
        categorias={categorias}
        centros={centros}
      />
    </div>
  );
}
