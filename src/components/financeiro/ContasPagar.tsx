import { useState, useMemo } from "react";
import { Plus, Search, Check, Copy, Trash2, Edit2, RotateCcw, AlertTriangle, Clock, CalendarDays } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, isToday, isBefore, startOfDay, endOfWeek, startOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NovaContaDialog } from "./NovaContaDialog";
import type { ContaPagar } from "@/hooks/useFinanceiro";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d + "T12:00:00"), "dd/MM/yyyy");

function getSmartStatus(c: ContaPagar): { key: string; label: string; color: string } {
  if (c.status === "paga") return { key: "paga", label: "Pago", color: "bg-success text-success-foreground" };
  if (c.status === "cancelada") return { key: "cancelada", label: "Cancelada", color: "bg-muted text-muted-foreground" };
  const venc = new Date(c.data_vencimento + "T23:59:59");
  const now = new Date();
  if (isBefore(venc, startOfDay(now))) return { key: "atrasado", label: "Atrasado", color: "bg-destructive text-destructive-foreground" };
  if (isToday(new Date(c.data_vencimento + "T12:00:00"))) return { key: "hoje", label: "Vence Hoje", color: "bg-warning text-warning-foreground" };
  return { key: "pendente", label: "Pendente", color: "bg-muted text-muted-foreground" };
}

interface Props {
  contas: ContaPagar[];
  categorias: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
  lojas: { id: string; nome: string }[];
  ordens: { id: string; numero: number; valor: number | null }[];
}

export function ContasPagar({ contas, categorias, centros, fornecedores, lojas, ordens }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterLoja, setFilterLoja] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null);
  const queryClient = useQueryClient();

  const contasComStatus = useMemo(() =>
    contas.map(c => ({ ...c, smartStatus: getSmartStatus(c) })),
    [contas]
  );

  // Priority sections
  const now = new Date();
  const weekEnd = endOfWeek(now, { locale: ptBR });
  const atrasadas = contasComStatus.filter(c => c.smartStatus.key === "atrasado");
  const hoje = contasComStatus.filter(c => c.smartStatus.key === "hoje");
  const semana = contasComStatus.filter(c =>
    c.smartStatus.key === "pendente" &&
    isWithinInterval(new Date(c.data_vencimento + "T12:00:00"), { start: now, end: weekEnd })
  );

  const filtered = contasComStatus.filter(c => {
    const q = search.toLowerCase();
    const fornNome = c.fornecedores?.nome ?? c.fornecedor ?? "";
    const matchSearch = !search || c.descricao.toLowerCase().includes(q) || fornNome.toLowerCase().includes(q);
    const matchStatus = filterStatus === "todos" || c.smartStatus.key === filterStatus;
    const matchLoja = filterLoja === "todas" || c.loja_id === filterLoja;
    return matchSearch && matchStatus && matchLoja;
  });

  const resolveEmpresaId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? "";

    let empresaId: string | undefined;

    if (uid) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("empresa_id")
        .or(`user_id.eq.${uid},id.eq.${uid}`)
        .eq("ativo", true)
        .maybeSingle();

      empresaId = profile?.empresa_id ?? undefined;
    }

    if (!empresaId) {
      const { data: emp } = await supabase
        .from("empresas")
        .select("id")
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();

      empresaId = emp?.id ?? undefined;
    }

    return empresaId;
  };

  const pagarMutation = useMutation({
    mutationFn: async (conta: ContaPagar) => {
      const { error } = await supabase
        .from("contas_a_pagar")
        .update({ status: "paga" as any, data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("id", conta.id);
      if (error) throw error;

      // Auto-generate next month for recurring
      if (conta.recorrente) {
        const empresaId = await resolveEmpresaId();
        const nextDate = new Date(conta.data_vencimento + "T12:00:00");
        nextDate.setMonth(nextDate.getMonth() + 1);
        const { error: insertErr } = await supabase.from("contas_a_pagar").insert({
          descricao: conta.descricao,
          categoria: conta.categoria,
          categoria_financeira_id: conta.categoria_financeira_id,
          centro_custo: conta.centro_custo,
          centro_custo_id: conta.centro_custo_id,
          fornecedor_id: conta.fornecedor_id,
          loja_id: conta.loja_id,
          ordem_servico_id: null,
          valor: conta.valor,
          data_vencimento: nextDate.toISOString().split("T")[0],
          recorrente: true,
          observacoes: conta.observacoes,
          status: "pendente" as any,
          empresa_id: empresaId,
        } as any);
        if (insertErr) console.error("Erro ao gerar recorrência:", insertErr);
      }
    },
    onSuccess: (_, conta) => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success(conta.recorrente ? "Conta paga! Próxima parcela gerada automaticamente." : "Conta marcada como paga!");
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
      const empresaId = await resolveEmpresaId();
      const nextMonth = new Date(conta.data_vencimento + "T12:00:00");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const { error } = await supabase.from("contas_a_pagar").insert({
        descricao: conta.descricao,
        categoria: conta.categoria,
        categoria_financeira_id: conta.categoria_financeira_id,
        centro_custo: conta.centro_custo,
        centro_custo_id: conta.centro_custo_id,
        fornecedor_id: conta.fornecedor_id,
        loja_id: conta.loja_id,
        ordem_servico_id: conta.ordem_servico_id,
        valor: conta.valor,
        data_vencimento: nextMonth.toISOString().split("T")[0],
        recorrente: conta.recorrente,
        observacoes: conta.observacoes,
        status: "pendente" as any,
        empresa_id: empresaId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta duplicada para o próximo mês!");
    },
  });

  const renderRow = (c: typeof contasComStatus[0]) => {
    const fornNome = c.fornecedores?.nome ?? c.fornecedor;
    const lojaNome = c.lojas?.nome;
    const osNum = c.ordens_de_servico?.numero;
    return (
      <tr key={c.id} className={c.smartStatus.key === "atrasado" ? "bg-destructive/5" : c.smartStatus.key === "hoje" ? "bg-warning/5" : ""}>
        <td>
          <p className="text-sm font-medium">{c.descricao}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {fornNome && <span className="text-[10px] text-muted-foreground">📦 {fornNome}</span>}
            {lojaNome && <span className="text-[10px] text-muted-foreground">🏪 {lojaNome}</span>}
            {osNum && <span className="text-[10px] text-info font-medium">OS #{osNum}</span>}
            {c.recorrente && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-info font-medium">
                <RotateCcw className="h-2.5 w-2.5" />Recorrente
              </span>
            )}
          </div>
        </td>
        <td className="hidden sm:table-cell text-sm text-muted-foreground">{c.categoria}</td>
        <td className={`text-sm ${c.smartStatus.key === "atrasado" ? "text-destructive font-medium" : c.smartStatus.key === "hoje" ? "text-warning font-medium" : ""}`}>
          {fmtDate(c.data_vencimento)}
        </td>
        <td className="text-sm font-medium">{fmtCurrency(c.valor)}</td>
        <td>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.smartStatus.color}`}>
            {c.smartStatus.label}
          </span>
        </td>
        <td>
          <div className="flex items-center justify-end gap-0.5">
            {c.status !== "paga" && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Marcar como paga" onClick={() => pagarMutation.mutate(c)}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => { setEditingConta(c); setDialogOpen(true); }}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-info" title="Duplicar" onClick={() => duplicarMutation.mutate(c)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => deleteMutation.mutate(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Priority alerts */}
      {(atrasadas.length > 0 || hoje.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {atrasadas.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {atrasadas.length} conta{atrasadas.length > 1 ? "s" : ""} atrasada{atrasadas.length > 1 ? "s" : ""} — {fmtCurrency(atrasadas.reduce((s, c) => s + Number(c.valor), 0))}
            </div>
          )}
          {hoje.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/8 px-3 py-1.5 text-xs font-semibold text-warning">
              <Clock className="h-3.5 w-3.5" />
              {hoje.length} conta{hoje.length > 1 ? "s" : ""} vencendo hoje — {fmtCurrency(hoje.reduce((s, c) => s + Number(c.valor), 0))}
            </div>
          )}
          {semana.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-info/30 bg-info/8 px-3 py-1.5 text-xs font-semibold text-info">
              <CalendarDays className="h-3.5 w-3.5" />
              {semana.length} conta{semana.length > 1 ? "s" : ""} esta semana — {fmtCurrency(semana.reduce((s, c) => s + Number(c.valor), 0))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
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
            <SelectItem value="hoje">Vence Hoje</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="paga">Pago</SelectItem>
          </SelectContent>
        </Select>
        {lojas.length > 0 && (
          <Select value={filterLoja} onValueChange={setFilterLoja}>
            <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas lojas</SelectItem>
              {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" className="gap-1.5 h-9" onClick={() => { setEditingConta(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Nova Conta
        </Button>
      </div>

      {/* Table */}
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
              {filtered.map(renderRow)}
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
        fornecedores={fornecedores}
        lojas={lojas}
        ordens={ordens as any}
      />
    </div>
  );
}
