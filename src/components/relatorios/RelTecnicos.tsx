import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, User, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDesempenhoTecnicos } from "@/hooks/useDesempenhoTecnicos";

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtT = (h: number) => !h ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;

export function RelTecnicos() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const ini = new Date(ano, mes, 1);
  const fim = new Date(ano, mes + 1, 0, 23, 59, 59);

  const { data: tecnicos = [], isLoading } = useDesempenhoTecnicos(ini, fim);

  const { data: enriq } = useQuery({
    queryKey: ["rel-tec-enriq", ini.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_servicos")
        .select(`id, tecnico_id, ordem_id, nome, concluido_em,
          ordens_de_servico!inner ( aparelho_id, defeito_relatado, data_entrada, data_conclusao )`)
        .eq("status", "concluido").not("tecnico_id", "is", null)
        .gte("concluido_em", ini.toISOString()).lte("concluido_em", fim.toISOString());
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const porTec = useMemo(() => {
    const map = new Map<string, { topServ: [string, number][]; retrab: number }>();
    const all = enriq ?? [];
    const grupos = new Map<string, any[]>();
    for (const s of all) {
      const a = grupos.get(s.tecnico_id) ?? [];
      a.push(s); grupos.set(s.tecnico_id, a);
    }
    for (const [tec, lista] of grupos.entries()) {
      const dc: Record<string, number> = {};
      for (const s of lista) dc[s.nome] = (dc[s.nome] || 0) + 1;
      const topServ = Object.entries(dc).sort((a, b) => b[1] - a[1]).slice(0, 5);
      let r = 0;
      for (const s of lista) {
        const os = s.ordens_de_servico;
        if (!os?.aparelho_id || !os?.defeito_relatado || !os?.data_conclusao) continue;
        const conc = new Date(os.data_conclusao).getTime();
        if (all.some(o => {
          if (o.id === s.id) return false;
          const oOs = o.ordens_de_servico;
          if (!oOs || oOs.aparelho_id !== os.aparelho_id || oOs.defeito_relatado !== os.defeito_relatado) return false;
          const e = new Date(oOs.data_entrada).getTime();
          return e > conc && (e - conc) < 30 * 86400000;
        })) r++;
      }
      map.set(tec, { topServ, retrab: lista.length > 0 ? (r / lista.length) * 100 : 0 });
    }
    return map;
  }, [enriq]);

  const prev = () => { if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1); };

  return (
    <TooltipProvider>
      <div className="space-y-6 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold text-lg min-w-[180px] text-center">{meses[mes]} {ano}</span>
          <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tecnicos.map(c => {
            const extra = porTec.get(c.funcionario_id);
            return (
              <Card key={c.funcionario_id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{c.nome}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Serviços: <strong>{c.qtd_servicos}</strong></div>
                    <div>OSs participou: <strong>{c.qtd_os}</strong></div>
                    <div>Tempo médio: <strong>{fmtT(Number(c.tempo_medio_horas) || 0)}</strong></div>
                    <div>Ticket médio: <strong>{fmt(Number(c.ticket_medio_os) || 0)}</strong></div>
                    <div>Valor serviços: <strong>{fmt(Number(c.valor_servicos) || 0)}</strong></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>Comissão: <strong>{fmt(Number(c.comissao_paga) + Number(c.comissao_total_a_receber))}</strong></div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pago: {fmt(Number(c.comissao_paga))}</p>
                        <p>A receber: {fmt(Number(c.comissao_total_a_receber))}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div>Retrabalho: <strong>{(extra?.retrab ?? 0).toFixed(1)}%</strong></div>
                  </div>
                  {extra && extra.topServ.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Serviços frequentes:</p>
                      <div className="flex flex-wrap gap-1">
                        {extra.topServ.map(([nome, count]) => (
                          <Badge key={nome} variant="secondary" className="text-xs">{nome} ({count})</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && tecnicos.length === 0 && (
            <p className="text-muted-foreground col-span-2 text-center py-8">Nenhum técnico com serviço no período.</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
