import { useState } from "react";
import { Search, Check, Eye, Users, DollarSign, CreditCard } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Comissao } from "@/hooks/useFinanceiro";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d), "dd/MM/yyyy");

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  liberada: { label: "Liberada", color: "bg-info text-info-foreground" },
  paga: { label: "Paga", color: "bg-success text-success-foreground" },
};

interface Props {
  comissoes: Comissao[];
  funcionarios: { id: string; nome: string }[];
  onViewOrder?: (orderId: string) => void;
}

export function Comissoes({ comissoes, funcionarios, onViewOrder }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterFunc, setFilterFunc] = useState("todos");
  const queryClient = useQueryClient();

  const filtered = comissoes.filter(c => {
    const q = search.toLowerCase();
    const nome = c.funcionarios?.nome ?? "";
    const matchSearch = !search || nome.toLowerCase().includes(q) || String(c.ordens_de_servico?.numero ?? "").includes(q);
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const matchFunc = filterFunc === "todos" || c.funcionario_id === filterFunc;
    return matchSearch && matchStatus && matchFunc;
  });

  // KPIs
  const totalPendente = comissoes.filter(c => c.status !== "paga").reduce((s, c) => s + Number(c.valor), 0);
  const countPendente = comissoes.filter(c => c.status === "pendente").length;
  const now = new Date();
  const pagasMes = comissoes
    .filter(c => c.status === "paga" && c.data_pagamento && new Date(c.data_pagamento).getMonth() === now.getMonth())
    .reduce((s, c) => s + Number(c.valor), 0);

  const pagarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "paga" as any, data_pagamento: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast.success("Comissão paga!");
    },
  });

  const liberarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "liberada" as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast.success("Comissão liberada!");
    },
  });

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-warning mb-2" />
          <p className="stat-value text-lg">{fmtCurrency(totalPendente)}</p>
          <p className="stat-label">Total a pagar</p>
        </div>
        <div className="stat-card">
          <Users className="h-4 w-4 text-info mb-2" />
          <p className="stat-value text-lg">{countPendente}</p>
          <p className="stat-label">Pendentes</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <CreditCard className="h-4 w-4 text-success mb-2" />
          <p className="stat-value text-lg text-success">{fmtCurrency(pagasMes)}</p>
          <p className="stat-label">Pagas no mês</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar funcionário ou nº OS..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterFunc} onValueChange={setFilterFunc}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos funcionários</SelectItem>
            {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="liberada">Liberada</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th className="hidden sm:table-cell">OS / Serviço</th>
                <th>Valor</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Data</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cfg = statusConfig[c.status] ?? statusConfig.pendente;
                const os = c.ordens_de_servico;
                const aparelho = os?.aparelhos ? `${os.aparelhos.marca} ${os.aparelhos.modelo}` : "";
                return (
                  <tr key={c.id}>
                    <td className="text-sm font-medium">{c.funcionarios?.nome ?? "—"}</td>
                    <td className="hidden sm:table-cell">
                      {os ? (
                        <div>
                          <p className="text-sm">OS #{String(os.numero).padStart(3, "0")}</p>
                          <p className="text-xs text-muted-foreground">{aparelho}</p>
                        </div>
                      ) : "—"}
                    </td>
                    <td>
                      <p className="text-sm font-semibold">{fmtCurrency(c.valor)}</p>
                      {c.valor_base ? <p className="text-xs text-muted-foreground">Base: {fmtCurrency(c.valor_base)}</p> : null}
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">{fmtDate(c.created_at)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        {c.status === "pendente" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-info" title="Liberar" onClick={() => liberarMutation.mutate(c.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(c.status === "pendente" || c.status === "liberada") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Marcar como paga" onClick={() => pagarMutation.mutate(c.id)}>
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {c.ordem_id && onViewOrder && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver OS" onClick={() => onViewOrder(c.ordem_id!)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">Nenhuma comissão encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
