import { useMemo, useState } from "react";
import { Check, CreditCard, DollarSign, Eye, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiberarComissao, usePagarComissao, usePagarComissoesLote } from "@/hooks/useComissoesActions";
import type { Comissao } from "@/hooks/useFinanceiro";
import { format } from "date-fns";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d), "dd/MM/yyyy");

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  liberada: { label: "Liberada", color: "bg-info text-info-foreground" },
  paga: { label: "Paga", color: "bg-success text-success-foreground" },
  estornada: { label: "Estornada", color: "bg-muted text-muted-foreground" },
};

interface Props {
  comissoes: Comissao[];
  funcionarios: { id: string; nome: string }[];
  tiposServico?: { id: string; nome: string }[];
  onViewOrder?: (orderId: string) => void;
}

export function Comissoes({ comissoes, funcionarios, onViewOrder }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterFunc, setFilterFunc] = useState("todos");
  const [selected, setSelected] = useState<string[]>([]);
  const liberarMutation = useLiberarComissao();
  const pagarMutation = usePagarComissao();
  const pagarLoteMutation = usePagarComissoesLote();

  const filtered = useMemo(() => comissoes.filter(c => {
    const q = search.toLowerCase();
    const nome = c.funcionarios?.nome ?? "";
    const osNumero = c.ordens_de_servico?.numero_formatado ?? String(c.ordens_de_servico?.numero ?? "");
    const servico = c.os_servicos?.nome ?? "";
    const matchSearch = !search || nome.toLowerCase().includes(q) || osNumero.toLowerCase().includes(q) || servico.toLowerCase().includes(q);
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const matchFunc = filterFunc === "todos" || c.funcionario_id === filterFunc;
    return matchSearch && matchStatus && matchFunc;
  }), [comissoes, filterFunc, filterStatus, search]);

  const payable = filtered.filter(c => c.status === "pendente" || c.status === "liberada");
  const selectedPayable = payable.filter(c => selected.includes(c.id));
  const selectedTotal = selectedPayable.reduce((s, c) => s + Number(c.valor), 0);
  const totalPendente = comissoes.filter(c => c.status === "pendente" || c.status === "liberada").reduce((s, c) => s + Number(c.valor), 0);
  const countPendente = comissoes.filter(c => c.status === "pendente").length;
  const now = new Date();
  const pagasMes = comissoes
    .filter(c => c.status === "paga" && c.data_pagamento && new Date(c.data_pagamento).getMonth() === now.getMonth())
    .reduce((s, c) => s + Number(c.valor), 0);

  const allPayableSelected = payable.length > 0 && payable.every(c => selected.includes(c.id));
  const toggleAll = (checked: boolean) => setSelected(checked ? payable.map(c => c.id) : []);
  const toggleOne = (id: string, checked: boolean) => setSelected(prev => checked ? [...prev, id] : prev.filter(item => item !== id));
  const handlePagarLote = () => {
    if (selectedPayable.length === 0) return;
    pagarLoteMutation.mutate(selectedPayable.map(c => c.id), { onSuccess: () => setSelected([]) });
  };

  return (
    <div className="space-y-4">
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

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar técnico, OS ou serviço..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterFunc} onValueChange={setFilterFunc}>
          <SelectTrigger className="w-full sm:w-52 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos técnicos</SelectItem>
            {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="liberada">Liberada</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="estornada">Estornada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
        <p className="text-sm text-muted-foreground">{selectedPayable.length} selecionada(s)</p>
        <Button size="sm" onClick={handlePagarLote} disabled={selectedPayable.length === 0 || pagarLoteMutation.isPending}>
          Pagar selecionadas ({fmtCurrency(selectedTotal)})
        </Button>
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox checked={allPayableSelected} onCheckedChange={v => toggleAll(v === true)} aria-label="Selecionar comissões pagáveis" />
                </th>
                <th>Data</th>
                <th>Técnico</th>
                <th>OS</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cfg = statusConfig[c.status] ?? statusConfig.pendente;
                const canPay = c.status === "pendente" || c.status === "liberada";
                const canRelease = c.status === "pendente";
                const osLabel = c.ordens_de_servico?.numero_formatado ?? (c.ordens_de_servico?.numero ? `#${String(c.ordens_de_servico.numero).padStart(3, "0")}` : "—");
                return (
                  <tr key={c.id}>
                    <td>
                      <Checkbox checked={selected.includes(c.id)} disabled={!canPay} onCheckedChange={v => toggleOne(c.id, v === true)} aria-label={`Selecionar comissão ${osLabel}`} />
                    </td>
                    <td className="text-sm text-muted-foreground">{fmtDate(c.data_pagamento ?? c.created_at)}</td>
                    <td className="text-sm font-medium">{c.funcionarios?.nome ?? "—"}</td>
                    <td className="text-sm">{osLabel}</td>
                    <td>
                      <p className="text-sm font-medium">{c.os_servicos?.nome ?? "—"}</p>
                      {c.os_servicos?.status && <p className="text-xs text-muted-foreground">{c.os_servicos.status}</p>}
                    </td>
                    <td>
                      <p className="text-sm font-semibold">{fmtCurrency(c.valor)}</p>
                      {c.valor_base ? <p className="text-xs text-muted-foreground">Base: {fmtCurrency(c.valor_base)}</p> : null}
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-info" title="Liberar" disabled={!canRelease || liberarMutation.isPending} onClick={() => liberarMutation.mutate(c.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Pagar" disabled={!canPay || pagarMutation.isPending} onClick={() => pagarMutation.mutate(c.id)}>
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
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
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                    {comissoes.length === 0 ? "Nenhuma comissão gerada ainda." : "Nenhuma comissão encontrada com os filtros atuais."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
