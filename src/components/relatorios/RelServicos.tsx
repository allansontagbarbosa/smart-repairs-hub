import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const COLORS = ["hsl(var(--primary))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))","hsl(var(--chart-5))","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

export function RelServicos() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const nextM = mes === 11 ? 0 : mes + 1;
  const nextY = mes === 11 ? ano + 1 : ano;
  const fim = `${nextY}-${String(nextM + 1).padStart(2, "0")}-01`;

  const { data: ordens } = useQuery({
    queryKey: ["rel-def-os", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, aparelho_id, data_entrada, data_conclusao, status")
        .is("deleted_at", null)
        .gte("data_entrada", inicio)
        .lt("data_entrada", fim);
      return data ?? [];
    },
  });

  const { data: aparelhos } = useQuery({
    queryKey: ["rel-def-ap", inicio],
    queryFn: async () => {
      const apIds = [...new Set((ordens ?? []).map(o => o.aparelho_id))];
      if (apIds.length === 0) return [];
      const { data } = await supabase.from("aparelhos").select("id, marca").in("id", apIds);
      return data ?? [];
    },
    enabled: (ordens ?? []).length > 0,
  });

  const { data: defeitos } = useQuery({
    queryKey: ["rel-srv-itens", inicio],
    queryFn: async () => {
      const osIds = (ordens ?? []).map(o => o.id);
      if (osIds.length === 0) return [];
      const { data } = await supabase.from("os_servicos").select("ordem_id, nome").in("ordem_id", osIds);
      return (data ?? []) as { ordem_id: string; nome: string }[];
    },
    enabled: (ordens ?? []).length > 0,
  });

  const { data: pecasUsadas } = useQuery({
    queryKey: ["rel-def-pecas", inicio],
    queryFn: async () => {
      const osIds = (ordens ?? []).map(o => o.id);
      if (osIds.length === 0) return [];
      const { data } = await supabase.from("pecas_utilizadas").select("peca_id, quantidade, ordem_id").in("ordem_id", osIds);
      return data ?? [];
    },
    enabled: (ordens ?? []).length > 0,
  });

  const { data: pecasNomes } = useQuery({
    queryKey: ["rel-def-pecas-nomes"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque").select("id, nome");
      return data ?? [];
    },
  });

  const analysis = useMemo(() => {
    const defCount: Record<string, number> = {};
    (defeitos ?? []).forEach(d => { defCount[d.nome] = (defCount[d.nome] || 0) + 1; });
    const total = (defeitos ?? []).length;

    const ranking = Object.entries(defCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, count]) => ({ nome, count, pct: total > 0 ? (count / total * 100).toFixed(1) : "0" }));

    const pieData = ranking.map(r => ({ name: r.nome, value: r.count }));

    // Defeitos por marca
    const marcaMap: Record<string, Record<string, number>> = {};
    (defeitos ?? []).forEach(d => {
      const os = (ordens ?? []).find(o => o.id === d.ordem_id);
      if (!os) return;
      const ap = (aparelhos ?? []).find(a => a.id === os.aparelho_id);
      const marca = ap?.marca ?? "Outros";
      if (!marcaMap[marca]) marcaMap[marca] = {};
      marcaMap[marca][d.nome] = (marcaMap[marca][d.nome] || 0) + 1;
    });
    const defeitosPorMarca = Object.entries(marcaMap).map(([marca, defs]) => {
      const sorted = Object.entries(defs).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const totalM = Object.values(defs).reduce((a, b) => a + b, 0);
      return { marca, top: sorted.map(([n, c]) => `${n} (${(c/totalM*100).toFixed(0)}%)`).join(" · "), total: totalM };
    }).sort((a, b) => b.total - a.total);

    // Peça mais usada
    const pecaCount: Record<string, number> = {};
    (pecasUsadas ?? []).forEach(p => { pecaCount[p.peca_id] = (pecaCount[p.peca_id] || 0) + p.quantidade; });
    const topPecaId = Object.entries(pecaCount).sort((a, b) => b[1] - a[1])[0];
    const topPeca = topPecaId ? { nome: (pecasNomes ?? []).find(p => p.id === topPecaId[0])?.nome ?? "—", qtd: topPecaId[1] } : null;

    // Tempo médio por defeito
    const tempoDefeito: Record<string, number[]> = {};
    (defeitos ?? []).forEach(d => {
      const os = (ordens ?? []).find(o => o.id === d.ordem_id);
      if (!os?.data_conclusao) return;
      const mins = (new Date(os.data_conclusao).getTime() - new Date(os.data_entrada).getTime()) / 60000;
      if (!tempoDefeito[d.nome]) tempoDefeito[d.nome] = [];
      tempoDefeito[d.nome].push(mins);
    });
    const tempoMedioPorDefeito = Object.entries(tempoDefeito)
      .map(([nome, ts]) => ({ nome, media: ts.reduce((a, b) => a + b, 0) / ts.length }))
      .sort((a, b) => a.media - b.media);

    return { ranking, pieData, defeitosPorMarca, topPeca, tempoMedioPorDefeito };
  }, [defeitos, ordens, aparelhos, pecasUsadas, pecasNomes]);

  const prev = () => { if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1); };

  function fmtTempo(min: number) {
    if (min < 60) return `${Math.round(min)}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h${Math.round(min % 60)}m`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-lg min-w-[180px] text-center">{meses[mes]} {ano}</span>
        <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de Serviços</CardTitle></CardHeader>
          <CardContent>
            {analysis.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={analysis.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {analysis.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">Sem dados no período.</p>}
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Serviços</CardTitle></CardHeader>
          <CardContent>
            {analysis.ranking.length > 0 ? (
              <div className="space-y-2">
                {analysis.ranking.map((r, i) => (
                  <div key={r.nome} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{r.nome}</span>
                    <span className="font-medium">{r.count}</span>
                    <span className="text-muted-foreground text-xs w-12 text-right">{r.pct}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">Sem dados.</p>}
          </CardContent>
        </Card>

        {/* Defeitos por marca */}
        <Card>
          <CardHeader><CardTitle className="text-base">Serviços por Marca</CardTitle></CardHeader>
          <CardContent>
            {analysis.defeitosPorMarca.length > 0 ? (
              <div className="space-y-2 text-sm">
                {analysis.defeitosPorMarca.map(m => (
                  <div key={m.marca}>
                    <span className="font-medium">{m.marca}:</span>{" "}
                    <span className="text-muted-foreground">{m.top}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">Sem dados.</p>}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader><CardTitle className="text-base">Indicadores</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {analysis.topPeca && (
              <div>
                <p className="text-muted-foreground">Peça mais utilizada:</p>
                <p className="font-medium">{analysis.topPeca.nome} ({analysis.topPeca.qtd}x)</p>
              </div>
            )}
            {analysis.tempoMedioPorDefeito.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">Tempo médio por serviço:</p>
                <div className="space-y-1">
                  {analysis.tempoMedioPorDefeito.slice(0, 8).map(t => (
                    <div key={t.nome} className="flex justify-between">
                      <span>{t.nome}</span>
                      <span className="font-medium">{fmtTempo(t.media)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
