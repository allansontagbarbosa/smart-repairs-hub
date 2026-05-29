import { useState } from "react";
import { Edit, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { DefinirMetaDialog } from "@/components/loja/DefinirMetaDialog";

function Termo({ cor, range, label }: { cor: string; range: string; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`h-3 w-3 rounded-full ${cor}`} />
      <span className="text-xs font-mono w-24 text-muted-foreground">{range}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default function LojaMetas() {
  const { empresaId } = useEmpresa();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const { data: meta } = useQuery({
    queryKey: ["loja-meta-atual", empresaId, ano, mes],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_metas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("competencia_ano", ano)
        .eq("competencia_mes", mes)
        .eq("tipo", "faturamento")
        .is("funcionario_id", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: realizado = 0 } = useQuery({
    queryKey: ["loja-realizado-mes", empresaId, ano, mes],
    queryFn: async () => {
      const ini = new Date(ano, mes - 1, 1).toISOString();
      const fim = new Date(ano, mes, 0, 23, 59, 59).toISOString();
      const { data, error } = await (supabase as any)
        .from("loja_vendas")
        .select("total")
        .eq("empresa_id", empresaId)
        .eq("status", "pago")
        .gte("created_at", ini)
        .lte("created_at", fim)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).reduce((s: number, v: any) => s + Number(v.total), 0);
    },
    enabled: !!empresaId,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["loja-historico-metas", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_metas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("tipo", "faturamento")
        .is("funcionario_id", null)
        .order("competencia_ano", { ascending: false })
        .order("competencia_mes", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const valorMeta = meta?.valor_meta ? Number(meta.valor_meta) : 0;
  const pct = valorMeta ? (realizado / valorMeta) * 100 : 0;
  const faltam = valorMeta ? Math.max(0, valorMeta - realizado) : 0;
  const diasRestantes = Math.max(0, new Date(ano, mes, 0).getDate() - hoje.getDate());
  const necessarioPorDia = diasRestantes > 0 ? faltam / diasRestantes : 0;

  const corBarra =
    pct >= 100 ? "bg-success" : pct >= 80 ? "bg-warning" : pct >= 50 ? "bg-warning" : "bg-destructive";
  const statusLabel =
    pct >= 110 ? "Super bônus liberado" : pct >= 100 ? "Meta batida" : pct >= 80 ? "Quase lá!" : pct >= 50 ? "Acelerar" : "Atenção";

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meta da loja e individuais · {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Editar meta
        </Button>
      </div>

      {!meta ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Target className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhuma meta definida</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Defina a meta de faturamento da loja pra este mês. Quando bater 100%, libera bônus pros vendedores.
          </p>
          <Button>
            <Target className="h-4 w-4 mr-2" />
            Definir meta de {hoje.toLocaleDateString("pt-BR", { month: "long" })}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Meta {hoje.toLocaleDateString("pt-BR", { month: "long" })}
                </h2>
                <Badge variant="outline">{statusLabel}</Badge>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-3xl font-bold">{formatBRL(realizado)}</p>
                <p className="text-sm text-muted-foreground">de {formatBRL(valorMeta)}</p>
                <p className="ml-auto text-2xl font-bold">{pct.toFixed(1)}%</p>
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden mb-6">
                <div
                  className={`h-full ${corBarra} transition-all`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Faltam</p>
                  <p className="text-base font-semibold mt-1">{formatBRL(faltam)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dias restantes</p>
                  <p className="text-base font-semibold mt-1">{diasRestantes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Necessário/dia</p>
                  <p className="text-base font-semibold mt-1">{formatBRL(necessarioPorDia)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold mb-3">Termômetro</h3>
              <div className="space-y-1">
                <Termo cor="bg-destructive" range="0-49%" label="Atenção" />
                <Termo cor="bg-warning" range="50-79%" label="Acelerar" />
                <Termo cor="bg-warning" range="80-99%" label="Quase lá!" />
                <Termo cor="bg-success" range="100-109%" label="Meta batida" />
                <Termo cor="bg-success" range="110%+" label="Super bônus" />
              </div>
            </div>
          </div>

          {historico.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Histórico (últimos 6 meses)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Mês</th>
                      <th className="text-right p-3">Meta</th>
                      <th className="text-right p-3">Realizado</th>
                      <th className="text-right p-3">%</th>
                      <th className="text-left p-3">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h: any) => (
                      <tr key={h.id} className="border-t border-border">
                        <td className="p-3">
                          {String(h.competencia_mes).padStart(2, "0")}/{h.competencia_ano}
                        </td>
                        <td className="p-3 text-right">{formatBRL(h.valor_meta)}</td>
                        <td className="p-3 text-right">
                          {h.valor_realizado ? formatBRL(h.valor_realizado) : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {h.valor_realizado && h.valor_meta
                            ? `${((Number(h.valor_realizado) / Number(h.valor_meta)) * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {h.fechada ? "Fechada" : "Aberta"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
