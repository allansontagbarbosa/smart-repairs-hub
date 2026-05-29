import { useState } from "react";
import { Briefcase, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function LojaVendedores() {
  const { empresaId } = useEmpresa();
  const [, setEditConfig] = useState<any>(null);

  const { data: vendedores = [], isLoading } = useQuery({
    queryKey: ["loja-vendedores", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funcionarios")
        .select(`id, nome, cargo, loja_vendedor_config(*)`)
        .eq("empresa_id", empresaId)
        .eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: stats = {} } = useQuery({
    queryKey: ["loja-vendedores-stats", empresaId],
    queryFn: async () => {
      const ini = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data, error } = await (supabase as any)
        .from("loja_vendas")
        .select("vendedor_id, total")
        .eq("empresa_id", empresaId)
        .eq("status", "pago")
        .gte("created_at", ini)
        .is("deleted_at", null);
      if (error) throw error;
      const s: Record<string, { qtd: number; total: number }> = {};
      (data ?? []).forEach((v: any) => {
        if (!v.vendedor_id) return;
        if (!s[v.vendedor_id]) s[v.vendedor_id] = { qtd: 0, total: 0 };
        s[v.vendedor_id].qtd++;
        s[v.vendedor_id].total += Number(v.total);
      });
      return s;
    },
    enabled: !!empresaId,
  });

  const ativos = vendedores.filter((v: any) => v.loja_vendedor_config?.[0]?.ativo);
  const semDados = !isLoading && vendedores.length === 0;
  const maiorPerf = Object.entries(stats).sort((a, b) => b[1].total - a[1].total)[0];
  const maiorPerfNome = maiorPerf
    ? vendedores.find((v: any) => v.id === maiorPerf[0])?.nome ?? "—"
    : "—";

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comissões, metas e bonificações da operação Loja
          </p>
        </div>
        <Button variant="outline" size="sm">Fechar comissões do mês</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">ATIVOS</p>
          <p className="text-2xl font-bold mt-1">{ativos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">COMISSÃO TOTAL NO MÊS</p>
          <p className="text-2xl font-bold mt-1">{formatBRL(0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">MAIOR PERFORMANCE</p>
          <p className="text-lg font-bold mt-1 truncate">{maiorPerfNome}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">BONIFICAÇÃO A PAGAR</p>
          <p className="text-2xl font-bold mt-1">{formatBRL(0)}</p>
        </div>
      </div>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Briefcase className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum funcionário cadastrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Cadastre funcionários na seção RH primeiro. Depois ative cada um como vendedor da Loja aqui.
          </p>
          <Button variant="outline" asChild>
            <Link to="/rh">Ir para RH</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Vendedor</th>
                  <th className="text-left p-3">Cargo</th>
                  <th className="text-right p-3">Vendas mês</th>
                  <th className="text-right p-3">Faturamento</th>
                  <th className="text-right p-3">Comissão</th>
                  <th className="text-left p-3">Config. Loja</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v: any) => {
                  const cfg = v.loja_vendedor_config?.[0];
                  const stat = (stats as any)[v.id];
                  const ativo = cfg?.ativo === true;
                  return (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-medium">{v.nome}</td>
                      <td className="p-3 text-muted-foreground">{v.cargo ?? "—"}</td>
                      <td className="p-3 text-right">{stat?.qtd ?? 0}</td>
                      <td className="p-3 text-right font-semibold">{formatBRL(stat?.total ?? 0)}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {cfg ? formatBRL(0) : "—"}
                      </td>
                      <td className="p-3">
                        {ativo ? (
                          <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Sem config</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" onClick={() => setEditConfig(v)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
