import { useMemo, useState } from "react";
import { Check, CreditCard, DollarSign, Eye, Search, Users, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiberarComissao, usePagarComissao, usePagarComissoesLote } from "@/hooks/useComissoesActions";
import type { Comissao } from "@/hooks/useFinanceiro";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatNumeroOS } from "@/lib/numeroOS";
import { DashboardPeriodFilter } from "@/components/dashboard/DashboardPeriodFilter";
import {
  type PeriodPreset,
  type PeriodRange,
  rangeFromPreset,
} from "@/components/dashboard/period-presets";
import { ExportButton } from "@/components/ExportButton";
import type { ExportRow } from "@/lib/exportData";

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
  type SortKey = "data" | "tecnico" | "valor" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };
  const liberarMutation = useLiberarComissao();
  const pagarMutation = usePagarComissao();
  const pagarLoteMutation = usePagarComissoesLote();
  // Filtro de período unificado: mesma curadoria de 9 presets do Dashboard e Assistência.
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("este_mes");
  const [periodRange, setPeriodRange] = useState<PeriodRange>(
    () => rangeFromPreset("este_mes")!
  );
  function handlePeriodChange(preset: PeriodPreset, range: PeriodRange) {
    setPeriodPreset(preset);
    setPeriodRange(range);
  }

  const filtered = useMemo(() => comissoes.filter(c => {
    const q = search.toLowerCase().trim();
    const tecnico = c.funcionarios?.nome ?? "";
    const osNumero = c.ordens_de_servico?.numero_formatado ?? String(c.ordens_de_servico?.numero ?? "");
    const servico = c.os_servicos?.nome ?? "";
    const aparelho = c.ordens_de_servico?.aparelhos
      ? `${c.ordens_de_servico.aparelhos.marca ?? ""} ${c.ordens_de_servico.aparelhos.modelo ?? ""}`.trim()
      : "";
    const cliente = c.ordens_de_servico?.aparelhos?.clientes?.nome ?? "";
    const matchSearch =
      !q ||
      tecnico.toLowerCase().includes(q) ||
      osNumero.toLowerCase().includes(q) ||
      servico.toLowerCase().includes(q) ||
      aparelho.toLowerCase().includes(q) ||
      cliente.toLowerCase().includes(q);
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const matchFunc = filterFunc === "todos" || c.funcionario_id === filterFunc;
    const os = c.ordens_de_servico;
    const dataRef = os?.data_conclusao ? new Date(os.data_conclusao) : null;
    const matchPeriodo = !dataRef
      ? false
      : dataRef >= periodRange.from && dataRef <= periodRange.to;
    return matchSearch && matchStatus && matchFunc && matchPeriodo;
  }), [comissoes, filterFunc, filterStatus, search, periodRange]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "data") {
        const da = a.data_pagamento ?? a.created_at;
        const db = b.data_pagamento ?? b.created_at;
        cmp = String(da).localeCompare(String(db));
      } else if (sortKey === "tecnico") {
        cmp = (a.funcionarios?.nome ?? "").localeCompare(b.funcionarios?.nome ?? "");
      } else if (sortKey === "valor") {
        cmp = Number(a.valor) - Number(b.valor);
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return cmp * dir;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const payable = filtered.filter(c => c.status === "pendente" || c.status === "liberada");
  const selectedPayable = payable.filter(c => selected.includes(c.id));
  const selectedTotal = selectedPayable.reduce((s, c) => s + Number(c.valor), 0);

  const totais = useMemo(() => {
    const ativas = filtered.filter(c => !c.estornada_em);
    const estornadas = filtered.filter(c => c.estornada_em);
    const inicioMes = startOfMonth(new Date());
    const fimMes = endOfMonth(new Date());

    const pagasMes = ativas.filter(c =>
      c.status === "paga" &&
      c.data_pagamento &&
      new Date(c.data_pagamento) >= inicioMes &&
      new Date(c.data_pagamento) <= fimMes
    );
    const estornadasMes = estornadas.filter(c =>
      c.estornada_em &&
      new Date(c.estornada_em) >= inicioMes &&
      new Date(c.estornada_em) <= fimMes
    );

    return {
      pendente: ativas.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0),
      liberada: ativas.filter(c => c.status === "liberada").reduce((s, c) => s + Number(c.valor || 0), 0),
      pagaMes: pagasMes.reduce((s, c) => s + Number(c.valor || 0), 0),
      estornadaMes: estornadasMes.reduce((s, c) => s + Number(c.valor || 0), 0),
      qtdPendentes: ativas.filter(c => c.status === "pendente").length,
      qtdLiberadas: ativas.filter(c => c.status === "liberada").length,
      qtdPagasMes: pagasMes.length,
      qtdEstornadasMes: estornadasMes.length,
    };
  }, [filtered]);

  const porFuncionario = useMemo(() => {
    const ativas = filtered.filter(c => !c.estornada_em);
    const map = new Map<string, { nome: string; pendente: number; liberada: number; paga: number; total: number; qtd: number }>();
    ativas.forEach(c => {
      const id = c.funcionario_id;
      const nome = c.funcionarios?.nome || "Sem funcionário";
      const cur = map.get(id) || { nome, pendente: 0, liberada: 0, paga: 0, total: 0, qtd: 0 };
      const v = Number(c.valor || 0);
      cur.total += v;
      cur.qtd += 1;
      if (c.status === "pendente") cur.pendente += v;
      if (c.status === "liberada") cur.liberada += v;
      if (c.status === "paga") cur.paga += v;
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const allPayableSelected = payable.length > 0 && payable.every(c => selected.includes(c.id));
  const toggleAll = (checked: boolean) => setSelected(checked ? payable.map(c => c.id) : []);
  const toggleOne = (id: string, checked: boolean) => setSelected(prev => checked ? [...prev, id] : prev.filter(item => item !== id));
  const handlePagarLote = () => {
    if (selectedPayable.length === 0) return;
    pagarLoteMutation.mutate(selectedPayable.map(c => c.id), { onSuccess: () => setSelected([]) });
  };

  const toComissoesRows = (): ExportRow[] => {
    return sorted.map((c) => ({
      "Técnico": c.funcionarios?.nome ?? "",
      "OS": c.ordens_de_servico?.numero
        ? `#${formatNumeroOS(c.ordens_de_servico.numero, c.ordens_de_servico.numero_formatado)}`
        : "",
      "Serviço": c.os_servicos?.nome ?? "",
      "Conclusão OS": c.ordens_de_servico?.data_conclusao
        ? fmtDate(c.ordens_de_servico.data_conclusao)
        : "",
      "Tipo": (c as any).tipo ?? "",
      "Valor Base": c.valor_base != null ? Number(c.valor_base) : "",
      "Valor": Number(c.valor),
      "Status": statusConfig[c.status]?.label ?? c.status,
      "Data Pagamento": c.data_pagamento ? fmtDate(c.data_pagamento) : "",
      "Estornada": c.estornada_em ? "Sim" : "Não",
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DashboardPeriodFilter
          preset={periodPreset}
          range={periodRange}
          onChange={handlePeriodChange}
        />
        <ExportButton resource="comissoes" sheetName="Comissoes" getRows={toComissoesRows} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-warning mb-2" />
          <p className="stat-value text-lg">{fmtCurrency(totais.pendente)}</p>
          <p className="stat-label">Pendentes</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totais.qtdPendentes} comissões</p>
        </div>
        <div className="stat-card">
          <Users className="h-4 w-4 text-info mb-2" />
          <p className="stat-value text-lg">{fmtCurrency(totais.liberada)}</p>
          <p className="stat-label">Liberadas (a pagar)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totais.qtdLiberadas} comissões</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <CreditCard className="h-4 w-4 text-success mb-2" />
          <p className="stat-value text-lg text-success">{fmtCurrency(totais.pagaMes)}</p>
          <p className="stat-label">Pagas este mês</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totais.qtdPagasMes} comissões</p>
        </div>
        <div className="stat-card border-destructive/20">
          <RotateCcw className="h-4 w-4 text-destructive mb-2" />
          <p className="stat-value text-lg text-destructive">{fmtCurrency(totais.estornadaMes)}</p>
          <p className="stat-label">Estornadas este mês</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totais.qtdEstornadasMes} comissões</p>
        </div>
      </div>

      {porFuncionario.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por funcionário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Funcionário</th>
                    <th className="text-right">Qtd</th>
                    <th className="text-right">Pendente</th>
                    <th className="text-right">Liberada</th>
                    <th className="text-right">Paga</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porFuncionario.map(f => (
                    <tr key={f.nome} className="border-t border-border">
                      <td className="py-1.5">{f.nome}</td>
                      <td className="text-right tabular-nums">{f.qtd}</td>
                      <td className="text-right tabular-nums text-warning">{fmtCurrency(f.pendente)}</td>
                      <td className="text-right tabular-nums text-info">{fmtCurrency(f.liberada)}</td>
                      <td className="text-right tabular-nums text-success">{fmtCurrency(f.paga)}</td>
                      <td className="text-right tabular-nums font-semibold">{fmtCurrency(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por técnico, cliente, OS, aparelho ou serviço..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
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
                <th><SortableHeader label="Data" active={sortKey === "data"} dir={sortDir} onClick={() => toggleSort("data")} /></th>
                <th><SortableHeader label="Técnico" active={sortKey === "tecnico"} dir={sortDir} onClick={() => toggleSort("tecnico")} /></th>
                <th>OS / Cliente</th>
                <th>Serviço</th>
                <th><SortableHeader label="Valor" active={sortKey === "valor"} dir={sortDir} onClick={() => toggleSort("valor")} /></th>
                <th><SortableHeader label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} /></th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const cfg = statusConfig[c.status] ?? statusConfig.pendente;
                const canPay = c.status === "pendente" || c.status === "liberada";
                const canRelease = c.status === "pendente";
                const osLabel = c.ordens_de_servico?.numero ? `#${formatNumeroOS(c.ordens_de_servico.numero, c.ordens_de_servico.numero_formatado)}` : "—";
                return (
                  <tr key={c.id}>
                    <td>
                      <Checkbox checked={selected.includes(c.id)} disabled={!canPay} onCheckedChange={v => toggleOne(c.id, v === true)} aria-label={`Selecionar comissão ${osLabel}`} />
                    </td>
                    <td className="text-sm text-muted-foreground">{fmtDate(c.data_pagamento ?? c.created_at)}</td>
                    <td className="text-sm font-medium">{c.funcionarios?.nome ?? "—"}</td>
                    <td className="text-sm">
                      <p>{osLabel}</p>
                      {c.ordens_de_servico?.aparelhos?.clientes?.nome && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                          {c.ordens_de_servico.aparelhos.clientes.nome}
                        </p>
                      )}
                    </td>
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

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
        active ? "text-foreground font-medium" : "text-muted-foreground"
      }`}
    >
      {label}
      <span className="text-[9px] tabular-nums">
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}
