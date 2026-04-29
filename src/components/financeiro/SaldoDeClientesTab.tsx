import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownUp, CreditCard, Loader2, Search, TrendingUp, Users, Wallet } from "lucide-react";
import { useClientesSaldos, type ClienteSaldoResumo } from "@/hooks/useClientesSaldos";
import { RegistrarPagamentoDialog } from "@/components/ClienteHistoricoSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type SortKey = "saldo_devedor" | "total_faturado" | "total_recebido" | "qtd_oss" | "ultima_os_data" | "ultimo_pagamento_data" | "nome";
type SortDirection = "asc" | "desc";

const fmtCurrency = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null | undefined) => d ? new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";
const saldoClass = (saldo: number) => saldo > 0 ? "text-destructive" : saldo < 0 ? "text-success" : "text-muted-foreground";

export function SaldoDeClientesTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [onlyDebito, setOnlyDebito] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("saldo_devedor");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pagamentoClienteId, setPagamentoClienteId] = useState<string | null>(null);
  const { data: clientes = [], isLoading } = useClientesSaldos();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes
      .filter((cliente) => (!onlyDebito || Number(cliente.saldo_devedor ?? 0) > 0) && (!term || cliente.nome.toLowerCase().includes(term)))
      .sort((a, b) => compareClientes(a, b, sortKey, sortDirection));
  }, [clientes, onlyDebito, search, sortDirection, sortKey]);

  const kpis = useMemo(() => {
    const comDebito = clientes.filter((cliente) => Number(cliente.saldo_devedor ?? 0) > 0);
    const maior = comDebito.reduce<ClienteSaldoResumo | null>((best, current) => !best || Number(current.saldo_devedor ?? 0) > Number(best.saldo_devedor ?? 0) ? current : best, null);
    return {
      totalAReceber: comDebito.reduce((sum, cliente) => sum + Number(cliente.saldo_devedor ?? 0), 0),
      clientesComDebito: comDebito.length,
      maior,
    };
  }, [clientes]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === "desc" ? "asc" : "desc");
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Kpi icon={Wallet} label="Total a receber" value={fmtCurrency(kpis.totalAReceber)} />
        <Kpi icon={Users} label="Clientes com débito" value={String(kpis.clientesComDebito)} />
        <Kpi icon={TrendingUp} label="Maior saldo devedor" value={kpis.maior ? fmtCurrency(kpis.maior.saldo_devedor) : "—"} hint={kpis.maior?.nome} />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={onlyDebito} onCheckedChange={setOnlyDebito} />
            Mostrar apenas com débito &gt; 0
          </label>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1080px]">
              <thead>
                <tr>
                  <th><SortButton label="Cliente" active={sortKey === "nome"} onClick={() => toggleSort("nome")} /></th>
                  <th className="text-right"><SortButton label="Saldo Devedor" active={sortKey === "saldo_devedor"} onClick={() => toggleSort("saldo_devedor")} /></th>
                  <th className="text-right"><SortButton label="Total Faturado" active={sortKey === "total_faturado"} onClick={() => toggleSort("total_faturado")} /></th>
                  <th className="text-right"><SortButton label="Total Recebido" active={sortKey === "total_recebido"} onClick={() => toggleSort("total_recebido")} /></th>
                  <th className="text-center"><SortButton label="OSs" active={sortKey === "qtd_oss"} onClick={() => toggleSort("qtd_oss")} /></th>
                  <th><SortButton label="Última OS" active={sortKey === "ultima_os_data"} onClick={() => toggleSort("ultima_os_data")} /></th>
                  <th><SortButton label="Último Pagamento" active={sortKey === "ultimo_pagamento_data"} onClick={() => toggleSort("ultimo_pagamento_data")} /></th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cliente) => (
                  <tr key={cliente.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${cliente.id}`)}>
                    <td><p className="font-medium text-primary hover:underline">{cliente.nome}</p><p className="text-xs text-muted-foreground">{cliente.telefone || "—"}</p></td>
                    <td className={`text-right font-semibold ${saldoClass(Number(cliente.saldo_devedor ?? 0))}`}>{fmtCurrency(cliente.saldo_devedor)}</td>
                    <td className="text-right">{fmtCurrency(cliente.total_faturado)}</td>
                    <td className="text-right text-muted-foreground">{fmtCurrency(cliente.total_recebido)}</td>
                    <td className="text-center">{cliente.qtd_oss}</td>
                    <td className="text-muted-foreground">{fmtDate(cliente.ultima_os_data)}</td>
                    <td className="text-muted-foreground">{fmtDate(cliente.ultimo_pagamento_data)}</td>
                    <td onClick={(e) => e.stopPropagation()}><Button size="sm" variant="outline" onClick={() => setPagamentoClienteId(cliente.id)}><CreditCard className="h-4 w-4 mr-2" />Registrar</Button></td>
                  </tr>
                ))}
                {filtered.length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagamentoClienteId ? <RegistrarPagamentoDialog open={!!pagamentoClienteId} onOpenChange={(open) => !open && setPagamentoClienteId(null)} clienteId={pagamentoClienteId} /> : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-3"><div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-lg font-semibold truncate">{value}</p>{hint ? <p className="text-xs text-muted-foreground truncate">{hint}</p> : null}</div></div></div>;
}

function SortButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}<ArrowDownUp className="h-3 w-3" /></button>;
}

function compareClientes(a: ClienteSaldoResumo, b: ClienteSaldoResumo, key: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  if (key === "nome") return a.nome.localeCompare(b.nome) * multiplier;
  if (key === "ultima_os_data" || key === "ultimo_pagamento_data") return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * multiplier;
  return (Number(a[key] ?? 0) - Number(b[key] ?? 0)) * multiplier;
}
