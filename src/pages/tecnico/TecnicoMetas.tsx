import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTecnicoIdentidade, useTecnicoMetricas } from "@/hooks/useTecnico";
import { Target, TrendingUp, Award, Info } from "lucide-react";

export default function TecnicoMetas() {
  const { data: identidade } = useTecnicoIdentidade();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const { data: metricas } = useTecnicoMetricas(identidade?.funcionario_id, ano, mes);

  const { data: meta } = useQuery({
    queryKey: ["tecnico-meta", identidade?.empresa_id, identidade?.funcionario_id, ano, mes],
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
    queryKey: ["equipe-meta", identidade?.empresa_id, ano, mes],
    enabled: !!identidade?.empresa_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipe_metas")
        .select("*")
        .eq("empresa_id", identidade!.empresa_id!)
        .eq("ano", ano)
        .eq("mes", mes)
        .maybeSingle();
      return data;
    },
  });

  const { data: qtdTecnicos = 1 } = useQuery({
    queryKey: ["qtd-tecnicos", identidade?.empresa_id],
    enabled: !!identidade?.empresa_id,
    queryFn: async () => {
      const { count } = await supabase
        .from("funcionarios")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", identidade!.empresa_id!)
        .eq("ativo", true);
      return Math.max(1, count ?? 1);
    },
  });

  const metaQtdEfetiva = meta?.meta_quantidade_os
    ?? (equipe?.meta_quantidade_os ? Math.ceil(equipe.meta_quantidade_os / qtdTecnicos) : 0);
  const metaValEfetiva = meta?.meta_valor_servicos
    ? Number(meta.meta_valor_servicos)
    : (equipe?.meta_faturamento ? Number(equipe.meta_faturamento) / qtdTecnicos : 0);
  const usandoFallback = !meta && !!equipe;

  const progressoQtd = useMemo(() => {
    if (!metaQtdEfetiva) return 0;
    return Math.min(100, ((metricas?.os_concluidas ?? 0) / metaQtdEfetiva) * 100);
  }, [metaQtdEfetiva, metricas]);

  const progressoVal = useMemo(() => {
    if (!metaValEfetiva) return 0;
    return Math.min(100, ((metricas?.valor_servicos ?? 0) / metaValEfetiva) * 100);
  }, [metaValEfetiva, metricas]);

  const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Minhas Metas</h1>
      <p className="text-xs text-muted-foreground">
        {new Date(ano, mes - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </p>

      {!meta && !equipe ? (
        <Card><CardContent className="py-6 text-center space-y-2">
          <Target className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm">Nenhuma meta definida pelo gestor para este mês.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> {usandoFallback ? "Sua parte da meta da equipe" : "Meta individual"}
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {usandoFallback && (
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Meta derivada da equipe (sua parte: {metaQtdEfetiva} OS / {fmtBrl(metaValEfetiva)})</span>
              </div>
            )}
            <MetaItem
              label="OS concluídas"
              atual={metricas?.os_concluidas ?? 0}
              meta={metaQtdEfetiva}
              progresso={progressoQtd}
            />
            <MetaItem
              label="Receita gerada"
              atual={fmtBrl(metricas?.valor_servicos ?? 0)}
              meta={fmtBrl(metaValEfetiva)}
              progresso={progressoVal}
            />
            {meta && Number(meta.bonus_meta_batida) > 0 && (
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
