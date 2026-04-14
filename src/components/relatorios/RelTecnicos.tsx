import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function RelTecnicos() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const nextM = mes === 11 ? 0 : mes + 1;
  const nextY = mes === 11 ? ano + 1 : ano;
  const fim = `${nextY}-${String(nextM + 1).padStart(2, "0")}-01`;

  const { data: tecnicos } = useQuery({
    queryKey: ["rel-tecnicos-func"],
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("id, nome, funcao").eq("ativo", true).is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: ordens } = useQuery({
    queryKey: ["rel-tecnicos-os", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, funcionario_id, status, valor, data_entrada, data_conclusao, aparelho_id, defeito_relatado")
        .is("deleted_at", null)
        .not("funcionario_id", "is", null)
        .gte("data_entrada", inicio)
        .lt("data_entrada", fim);
      return data ?? [];
    },
  });

  const { data: defeitos } = useQuery({
    queryKey: ["rel-tecnicos-defeitos", inicio],
    queryFn: async () => {
      const osIds = (ordens ?? []).map(o => o.id);
      if (osIds.length === 0) return [];
      const { data } = await supabase.from("os_defeitos").select("ordem_id, nome").in("ordem_id", osIds);
      return data ?? [];
    },
    enabled: (ordens ?? []).length > 0,
  });

  const { data: comissoes } = useQuery({
    queryKey: ["rel-tecnicos-comissoes", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("funcionario_id, valor")
        .gte("created_at", inicio)
        .lt("created_at", fim);
      return data ?? [];
    },
  });

  // Retrabalho: OS with same aparelho_id + same defeito within 30 days of a previous concluded OS
  const { data: retrabalhoMap } = useQuery({
    queryKey: ["rel-tecnicos-retrabalho", inicio],
    queryFn: async () => {
      // Get all concluded OS in the period with aparelho
      const funcIds = (tecnicos ?? []).map(t => t.id);
      if (funcIds.length === 0) return {} as Record<string, number>;
      const { data: allOS } = await supabase
        .from("ordens_de_servico")
        .select("id, funcionario_id, aparelho_id, defeito_relatado, data_entrada, data_conclusao")
        .is("deleted_at", null)
        .not("funcionario_id", "is", null)
        .in("funcionario_id", funcIds)
        .not("data_conclusao", "is", null)
        .order("data_entrada", { ascending: true });
      
      const map: Record<string, number> = {};
      const osArr = allOS ?? [];
      for (const os of osArr) {
        if (!os.funcionario_id) continue;
        // Check if there's a previous OS for same aparelho with same defeito within 30 days
        const prev = osArr.find(p =>
          p.id !== os.id &&
          p.aparelho_id === os.aparelho_id &&
          p.defeito_relatado === os.defeito_relatado &&
          p.data_conclusao &&
          new Date(os.data_entrada).getTime() - new Date(p.data_conclusao).getTime() < 30 * 86400000 &&
          new Date(os.data_entrada).getTime() > new Date(p.data_conclusao).getTime()
        );
        if (prev) {
          map[os.funcionario_id] = (map[os.funcionario_id] || 0) + 1;
        }
      }
      return map;
    },
    enabled: (tecnicos ?? []).length > 0,
  });

  const cards = useMemo(() => {
    return (tecnicos ?? []).map(tec => {
      const osT = (ordens ?? []).filter(o => o.funcionario_id === tec.id);
      const concluidas = osT.filter(o => ["pronto", "entregue"].includes(o.status));
      const emAndamento = osT.filter(o => !["pronto", "entregue"].includes(o.status));
      const receita = concluidas.reduce((s, o) => s + (o.valor ?? 0), 0);
      const comissao = (comissoes ?? []).filter(c => c.funcionario_id === tec.id).reduce((s, c) => s + c.valor, 0);

      // Tempo médio
      const tempos = concluidas
        .filter(o => o.data_conclusao && o.data_entrada)
        .map(o => (new Date(o.data_conclusao!).getTime() - new Date(o.data_entrada).getTime()) / 60000);
      const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

      // Defeitos
      const defT = (defeitos ?? []).filter(d => osT.some(o => o.id === d.ordem_id));
      const defCount: Record<string, number> = {};
      defT.forEach(d => { defCount[d.nome] = (defCount[d.nome] || 0) + 1; });
      const topDef = Object.entries(defCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const retrabalho = retrabalhoMap?.[tec.id] ?? 0;
      const taxaRetrabalho = concluidas.length > 0 ? (retrabalho / concluidas.length) * 100 : 0;

      return { tec, concluidas: concluidas.length, emAndamento: emAndamento.length, receita, comissao, tempoMedio, topDef, taxaRetrabalho };
    }).sort((a, b) => b.concluidas - a.concluidas);
  }, [tecnicos, ordens, defeitos, comissoes, retrabalhoMap]);

  const prev = () => { if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1); };

  function fmtTempo(min: number) {
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h < 24) return `${h}h ${m}min`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-lg min-w-[180px] text-center">{meses[mes]} {ano}</span>
        <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(c => (
          <Card key={c.tec.id}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{c.tec.nome}</p>
                  {c.tec.funcao && <p className="text-xs text-muted-foreground">{c.tec.funcao}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>OS concluídas: <strong>{c.concluidas}</strong></div>
                <div>Em andamento: <strong>{c.emAndamento}</strong></div>
                <div>Tempo médio: <strong>{fmtTempo(c.tempoMedio)}</strong></div>
                <div>Receita: <strong>{fmt(c.receita)}</strong></div>
                <div>Comissão: <strong>{fmt(c.comissao)}</strong></div>
                <div>Retrabalho: <strong>{c.taxaRetrabalho.toFixed(1)}%</strong></div>
              </div>
              {c.topDef.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Defeitos frequentes:</p>
                  <div className="flex flex-wrap gap-1">
                    {c.topDef.map(([nome, count]) => (
                      <Badge key={nome} variant="secondary" className="text-xs">{nome} ({count})</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {cards.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-8">Nenhum técnico com OS no período.</p>
        )}
      </div>
    </div>
  );
}
