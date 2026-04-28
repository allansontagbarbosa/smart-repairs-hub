import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

type ServicoRel = {
  id: string;
  tecnico_id: string | null;
  ordem_id: string;
  status: string;
  valor: number | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  created_at: string;
  nome: string;
  funcionarios?: { nome: string; funcao: string | null } | null;
  ordens_de_servico?: {
    aparelho_id: string | null;
    defeito_relatado: string | null;
    data_entrada: string;
    data_conclusao: string | null;
  } | null;
};

type ComissaoRel = {
  funcionario_id: string;
  valor: number;
  status: string;
};

export function RelTecnicos() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const nextM = mes === 11 ? 0 : mes + 1;
  const nextY = mes === 11 ? ano + 1 : ano;
  const fim = `${nextY}-${String(nextM + 1).padStart(2, "0")}-01`;

  const { data: servicos } = useQuery({
    queryKey: ["rel-tecnicos-servicos-v2", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_servicos")
        .select(`
          id, tecnico_id, ordem_id, status, valor, iniciado_em, concluido_em, created_at, nome,
          funcionarios!os_servicos_tecnico_id_fkey ( nome, funcao ),
          ordens_de_servico ( aparelho_id, defeito_relatado, data_entrada, data_conclusao )
        `)
        .not("tecnico_id", "is", null)
        .gte("created_at", inicio)
        .lt("created_at", fim);
      if (error) throw error;
      return (data ?? []) as ServicoRel[];
    },
  });

  const { data: comissoes } = useQuery({
    queryKey: ["rel-tecnicos-comissoes-v2", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("funcionario_id, valor, status")
        .is("estornada_em", null)
        .gte("created_at", inicio)
        .lt("created_at", fim);
      if (error) throw error;
      return (data ?? []) as ComissaoRel[];
    },
  });

  const cards = useMemo(() => {
    const servicosPorTecnico = new Map<string, ServicoRel[]>();
    (servicos ?? []).forEach(servico => {
      if (!servico.tecnico_id) return;
      servicosPorTecnico.set(servico.tecnico_id, [...(servicosPorTecnico.get(servico.tecnico_id) ?? []), servico]);
    });

    return Array.from(servicosPorTecnico.entries()).map(([tecnicoId, lista]) => {
      const concluidos = lista.filter(s => s.status === "concluido");
      const emAndamento = lista.filter(s => s.status === "em_reparo");
      const ossParticipou = new Set(lista.map(s => s.ordem_id)).size;
      const valorTotalServicos = concluidos.reduce((sum, s) => sum + Number(s.valor ?? 0), 0);
      const tempos = concluidos
        .filter(s => s.iniciado_em && s.concluido_em)
        .map(s => (new Date(s.concluido_em!).getTime() - new Date(s.iniciado_em!).getTime()) / 1000);
      const tempoMedioSegundos = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

      const comissoesTecnico = (comissoes ?? []).filter(c => c.funcionario_id === tecnicoId);
      const comissaoPaga = comissoesTecnico.filter(c => c.status === "paga").reduce((s, c) => s + Number(c.valor), 0);
      const comissaoAPagar = comissoesTecnico.filter(c => c.status === "pendente" || c.status === "liberada").reduce((s, c) => s + Number(c.valor), 0);
      const comissaoTotal = comissaoPaga + comissaoAPagar;

      const retrabalho = concluidos.filter(servico => {
        const os = servico.ordens_de_servico;
        if (!os?.aparelho_id || !os.defeito_relatado) return false;
        return (servicos ?? []).some(prev => {
          const prevOs = prev.ordens_de_servico;
          if (prev.id === servico.id || !prevOs?.data_conclusao) return false;
          if (prevOs.aparelho_id !== os.aparelho_id || prevOs.defeito_relatado !== os.defeito_relatado) return false;
          const entrada = new Date(os.data_entrada).getTime();
          const conclusaoAnterior = new Date(prevOs.data_conclusao).getTime();
          return entrada > conclusaoAnterior && entrada - conclusaoAnterior < 30 * 86400000;
        });
      }).length;
      const taxaRetrabalho = concluidos.length > 0 ? (retrabalho / concluidos.length) * 100 : 0;

      const defCount: Record<string, number> = {};
      lista.forEach(s => { defCount[s.nome] = (defCount[s.nome] || 0) + 1; });
      const topDef = Object.entries(defCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const funcionario = lista[0]?.funcionarios;

      return {
        tecnicoId,
        nome: funcionario?.nome ?? "Técnico",
        funcao: funcionario?.funcao,
        servicosConcluidos: concluidos.length,
        emAndamento: emAndamento.length,
        ossParticipou,
        tempoMedioSegundos,
        valorTotalServicos,
        comissaoPaga,
        comissaoAPagar,
        comissaoTotal,
        taxaRetrabalho,
        topDef,
      };
    }).sort((a, b) => b.servicosConcluidos - a.servicosConcluidos);
  }, [comissoes, servicos]);

  const prev = () => { if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1); };

  function fmtTempo(segundos: number) {
    const min = segundos / 60;
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h < 24) return `${h}h ${m}min`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold text-lg min-w-[180px] text-center">{meses[mes]} {ano}</span>
          <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(c => (
            <Card key={c.tecnicoId}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    {c.funcao && <p className="text-xs text-muted-foreground">{c.funcao}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Serviços: <strong>{c.servicosConcluidos}</strong></div>
                  <div>Em andamento: <strong>{c.emAndamento}</strong></div>
                  <div>OSs participou: <strong>{c.ossParticipou}</strong></div>
                  <div>Tempo médio: <strong>{fmtTempo(c.tempoMedioSegundos)}</strong></div>
                  <div>Valor serviços: <strong>{fmt(c.valorTotalServicos)}</strong></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>Comissão: <strong>{fmt(c.comissaoTotal)}</strong></div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pago: {fmt(c.comissaoPaga)}</p>
                      <p>A pagar: {fmt(c.comissaoAPagar)}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div>Retrabalho: <strong>{c.taxaRetrabalho.toFixed(1)}%</strong></div>
                </div>
                {c.topDef.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Serviços frequentes:</p>
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
            <p className="text-muted-foreground col-span-2 text-center py-8">Nenhum técnico com serviço no período.</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
