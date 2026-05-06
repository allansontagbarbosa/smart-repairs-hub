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

        <p className="text-xs text-muted-foreground">
          Mesmos números da página <a href="/tecnicos/desempenho" className="underline">Desempenho dos técnicos</a> — regime de competência (data de conclusão).
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {tecnicos.map((t, i) => {
            const e = porTec.get(t.funcionario_id);
            const lider = i === 0 && Number(t.comissao_total_a_receber) > 0;
            return (
              <Card key={t.funcionario_id} className={lider ? "border-primary/40" : ""}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-semibold">{t.nome}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Serviços: <strong>{t.qtd_servicos}</strong></div>
                    <div>OSs: <strong>{t.qtd_os}</strong></div>
                    <div>Faturamento: <strong>{fmt(Number(t.faturamento_os))}</strong></div>
                    <div>Ticket médio: <strong>{fmt(Number(t.ticket_medio_os))}</strong></div>
                    <div>Tempo médio: <strong>{fmtT(Number(t.tempo_medio_horas))}</strong></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>Comissão: <strong>{fmt(Number(t.comissao_total_a_receber) + Number(t.comissao_paga))}</strong></div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>A receber: {fmt(Number(t.comissao_total_a_receber))}</p>
                        <p>Paga: {fmt(Number(t.comissao_paga))}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="col-span-2">
                      Retrabalho: <strong>{e?.retrab.toFixed(1) ?? "0.0"}%</strong>
                      {e && e.retrab > 5 && <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" />}
                    </div>
                  </div>
                  {e && e.topServ.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Serviços frequentes:</p>
                      <div className="flex flex-wrap gap-1">
                        {e.topServ.map(([n, c]) => (
                          <Badge key={n} variant="secondary" className="text-xs">{n} ({c})</Badge>
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
