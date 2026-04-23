import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTecnicoIdentidade, useTecnicoMetricas } from "@/hooks/useTecnico";
import { Target, TrendingUp, Award } from "lucide-react";

export default function TecnicoMetas() {
  const { data: identidade } = useTecnicoIdentidade();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const { data: metricas } = useTecnicoMetricas(identidade?.funcionario_id, ano, mes);

  const { data: meta } = useQuery({
    queryKey: ["tecnico-meta", identidade?.funcionario_id, ano, mes],
    enabled: !!identidade?.funcionario_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tecnicos_metas")
        .select("*")
        .eq("funcionario_id", identidade!.funcionario_id!)
        .eq("ano", ano)
        .eq("mes", mes)
        .maybeSingle();
      return data;
    },
  });

  const { data: equipe } = useQuery({
    queryKey: ["equipe-meta", ano, mes],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipe_metas").select("*").eq("ano", ano).eq("mes", mes).maybeSingle();
      return data;
    },
  });

  const progressoQtd = useMemo(() => {
    if (!meta?.meta_quantidade_os) return 0;
    return Math.min(100, ((metricas?.os_concluidas ?? 0) / meta.meta_quantidade_os) * 100);
  }, [meta, metricas]);

  const progressoVal = useMemo(() => {
    if (!meta?.meta_valor_servicos) return 0;
    return Math.min(100, ((metricas?.valor_servicos ?? 0) / Number(meta.meta_valor_servicos)) * 100);
  }, [meta, metricas]);

  const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Minhas Metas</h1>
      <p className="text-xs text-muted-foreground">
        {new Date(ano, mes - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </p>

      {!meta ? (
        <Card><CardContent className="py-6 text-center space-y-2">
          <Target className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm">Nenhuma meta definida pelo gestor para este mês.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> Meta individual
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <MetaItem
              label="OS concluídas"
              atual={metricas?.os_concluidas ?? 0}
              meta={meta.meta_quantidade_os ?? 0}
              progresso={progressoQtd}
            />
            <MetaItem
              label="Valor faturado"
              atual={fmtBrl(metricas?.valor_servicos ?? 0)}
              meta={fmtBrl(Number(meta.meta_valor_servicos ?? 0))}
              progresso={progressoVal}
            />
            {Number(meta.bonus_meta_batida) > 0 && (
              <div className="flex items-center gap-2 text-xs bg-accent/40 rounded-md p-2">
                <Award className="h-4 w-4 text-primary" />
                Bônus por meta batida: <strong>{fmtBrl(Number(meta.bonus_meta_batida))}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {equipe && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Meta da equipe
          </CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Quantidade alvo: <strong>{equipe.meta_quantidade_os}</strong> OS</p>
            <p>Faturamento alvo: <strong>{fmtBrl(Number(equipe.meta_faturamento ?? 0))}</strong></p>
            {Number(equipe.bonus_equipe_batida) > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                Bônus distribuído se a equipe bater: {fmtBrl(Number(equipe.bonus_equipe_batida))}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetaItem({ label, atual, meta, progresso }: { label: string; atual: any; meta: any; progresso: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span><strong>{atual}</strong> <span className="text-muted-foreground">/ {meta}</span></span>
      </div>
      <Progress value={progresso} className="h-2" />
      <p className="text-[11px] text-right text-muted-foreground">{progresso.toFixed(0)}%</p>
    </div>
  );
}
