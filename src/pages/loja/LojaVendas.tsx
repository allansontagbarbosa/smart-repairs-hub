import { useState } from "react";
import { Download, Search, ClipboardList, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, maskCPF, maskIMEI } from "@/lib/utils";
import { Link } from "react-router-dom";

type Tab = "todas" | "hoje" | "pendentes" | "estornadas";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pago: "bg-success/15 text-success border-success/30",
    pendente: "bg-warning/15 text-warning border-warning/30",
    cancelado: "bg-muted text-muted-foreground",
    estornado: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

export default function LojaVendas() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState<Tab>("todas");
  const [busca, setBusca] = useState("");

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["loja-vendas", empresaId, tab, busca],
    queryFn: async () => {
      let q = (supabase as any)
        .from("loja_vendas")
        .select(
          `*, clientes(nome, cpf), funcionarios(nome), loja_vendas_itens(aparelho_id, loja_aparelhos(modelo, capacidade, imei_1)), loja_pagamentos(forma, valor, parcelas)`,
        )
        .eq("empresa_id", empresaId)
        .is("deleted_at", null);

      if (tab === "hoje") {
        const hoje = new Date().toISOString().slice(0, 10);
        q = q.gte("created_at", hoje);
      }
      if (tab === "pendentes") q = q.eq("status", "pendente");
      if (tab === "estornadas") q = q.eq("status", "estornado");
      if (busca) q = q.eq("numero_venda", parseInt(busca) || 0);

      const { data, error } = await q.order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: kpis } = useQuery({
    queryKey: ["loja-vendas-kpis", empresaId],
    queryFn: async () => {
      const hoje = new Date();
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
      const { data, error } = await (supabase as any)
        .from("loja_vendas")
        .select("total, status")
        .eq("empresa_id", empresaId)
        .gte("created_at", ini)
        .is("deleted_at", null);
      if (error) throw error;
      const rows = data ?? [];
      const pagas = rows.filter((v: any) => v.status === "pago");
      const faturamento = pagas.reduce((s: number, v: any) => s + Number(v.total), 0);
      return {
        qtd: pagas.length,
        faturamento,
        ticket: pagas.length ? faturamento / pagas.length : 0,
        canceladas: rows.filter((v: any) => v.status === "cancelado" || v.status === "estornado").length,
      };
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && vendas.length === 0 && !busca;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {kpis ? `${kpis.qtd} vendas · ${formatBRL(kpis.faturamento)} faturados no mês` : "carregando..."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" asChild>
            <Link to="/loja/pdv">⚡ Nova venda (F1)</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">VENDAS NO MÊS</p>
          <p className="text-2xl font-bold mt-1">{kpis?.qtd ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">FATURAMENTO</p>
          <p className="text-2xl font-bold mt-1">{formatBRL(kpis?.faturamento ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">TICKET MÉDIO</p>
          <p className="text-2xl font-bold mt-1">{formatBRL(kpis?.ticket ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">CANCELAMENTOS</p>
          <p className="text-2xl font-bold mt-1">{kpis?.canceladas ?? 0}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="estornadas">Estornadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhuma venda registrada</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Quando você fechar uma venda no PDV, ela aparece aqui com todos os detalhes.
          </p>
          <Button asChild>
            <Link to="/loja/pdv">Ir pro PDV</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nº venda..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Aparelho</th>
                  <th className="text-left p-3">Vendedor</th>
                  <th className="text-left p-3">Pagamento</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v: any) => (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">
                      #V-{String(v.numero_venda).padStart(6, "0")}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(v.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3">
                      {v.clientes ? (
                        <>
                          <p className="font-medium">{v.clientes.nome}</p>
                          <p className="text-xs text-muted-foreground">{maskCPF(v.clientes.cpf ?? "")}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sem cliente</span>
                      )}
                    </td>
                    <td className="p-3">
                      {v.loja_vendas_itens?.[0]?.loja_aparelhos && (
                        <>
                          <p className="font-medium">
                            {v.loja_vendas_itens[0].loja_aparelhos.modelo}{" "}
                            {v.loja_vendas_itens[0].loja_aparelhos.capacidade}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {maskIMEI(v.loja_vendas_itens[0].loja_aparelhos.imei_1 ?? "")}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{v.funcionarios?.nome ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {v.loja_pagamentos?.map((p: any) => p.forma).join(" + ") ?? "—"}
                    </td>
                    <td className="p-3 text-right font-semibold">{formatBRL(v.total)}</td>
                    <td className="p-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
