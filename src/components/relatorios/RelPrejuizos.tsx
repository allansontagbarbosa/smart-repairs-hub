import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, User, TrendingDown, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useListarPrejuizos } from "@/hooks/usePrejuizos";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type TecnicoRow = {
  tecnico_id: string;
  tecnico_nome: string;
  qtd_prejuizos: number;
  total_centavos: number;
  qtd_operacionais: number;
  qtd_nao_operacionais: number;
};

type EvolucaoRow = {
  ano_mes: string;
  operacional_centavos: number;
  nao_operacional_centavos: number;
  total_centavos: number;
  qtd: number;
};

type TopOSAcc = { os_numero: string; total: number; qtd: number; tipos: Set<string> };

export function RelPrejuizos() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const nextM = mes === 11 ? 0 : mes + 1;
  const nextY = mes === 11 ? ano + 1 : ano;
  const fim = `${nextY}-${String(nextM + 1).padStart(2, "0")}-01`;

  const { data: evolucao } = useQuery({
    queryKey: ["rel-prej-evolucao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("prejuizos_evolucao_mensal", { p_meses: 12 });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error ?? "Erro");
      return (r.meses ?? []) as EvolucaoRow[];
    },
  });

  const { data: porTecnico } = useQuery({
    queryKey: ["rel-prej-tecnico", inicio, fim],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("prejuizos_por_tecnico", {
        p_data_inicio: inicio,
        p_data_fim: fim,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error ?? "Erro");
      return (r.tecnicos ?? []) as TecnicoRow[];
    },
  });

  const { data: listaPrej } = useListarPrejuizos({
    data_inicio: inicio,
    data_fim: fim,
    tipo: null,
  });

  const topOSs = useMemo(() => {
    const items = listaPrej?.prejuizos ?? [];
    const porOs = new Map<string, TopOSAcc>();
    for (const p of items as any[]) {
      const osId = p.os_origem?.id || p.os_retrabalho?.id;
      const osNumero = p.os_origem?.numero || p.os_retrabalho?.numero;
      if (!osId || !osNumero) continue;
      const cur = porOs.get(osId) ?? { os_numero: osNumero, total: 0, qtd: 0, tipos: new Set<string>() };
      cur.total += p.valor_centavos;
      cur.qtd += 1;
      cur.tipos.add(p.tipo_label);
      porOs.set(osId, cur);
    }
    return Array.from(porOs.entries())
      .map(([id, v]) => ({ os_id: id, os_numero: v.os_numero, total: v.total, qtd: v.qtd, tipos: Array.from(v.tipos) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [listaPrej]);

  const chartData = useMemo(() => {
    return (evolucao ?? []).map((m) => {
      const [y, mm] = m.ano_mes.split("-");
      return {
        mes: `${meses[parseInt(mm) - 1]}/${y.slice(2)}`,
        Operacional: m.operacional_centavos / 100,
        "Não-operacional": m.nao_operacional_centavos / 100,
      };
    });
  }, [evolucao]);

  const prev = () => {
    if (mes === 0) {
      setMes(11);
      setAno(ano - 1);
    } else setMes(mes - 1);
  };
  const next = () => {
    if (mes === 11) {
      setMes(0);
      setAno(ano + 1);
    } else setMes(mes + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[120px] text-center">
            {meses[mes]}/{ano}
          </div>
          <Button variant="outline" size="icon" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Período afeta ranking de técnicos e top OSs. Gráfico de evolução é fixo nos últimos 12 meses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4" />
            Evolução de prejuízos — últimos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Operacional" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="Não-operacional" stackId="a" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-2">
            Operacional: garantia + peça danificada + cancelamento. Não-operacional: fraude + furto + cliente sumiu + outro.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Prejuízos por técnico — {meses[mes]}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(porTecnico ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum prejuízo vinculado a técnico neste período.
              <br />
              <span className="text-xs">Prejuízos só aparecem aqui se a OS de origem tinha técnico associado.</span>
            </p>
          ) : (
            <div className="space-y-2">
              {(porTecnico ?? []).map((t, idx) => (
                <div key={t.tecnico_id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.tecnico_nome}</p>
                      <div className="flex gap-1 mt-1">
                        {t.qtd_operacionais > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {t.qtd_operacionais} operacional
                          </Badge>
                        )}
                        {t.qtd_nao_operacionais > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t.qtd_nao_operacionais} não-op
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-destructive">{fmt(t.total_centavos)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.qtd_prejuizos} {t.qtd_prejuizos === 1 ? "prejuízo" : "prejuízos"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Top 10 OSs com maior prejuízo — {meses[mes]}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topOSs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum prejuízo vinculado a OS neste período.
            </p>
          ) : (
            <div className="space-y-2">
              {topOSs.map((os, idx) => (
                <a
                  key={os.os_id}
                  href={`/assistencia?os=${os.os_id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">OS #{os.os_numero}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {os.tipos.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-destructive">{fmt(os.total)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {os.qtd} {os.qtd === 1 ? "ocorrência" : "ocorrências"}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
