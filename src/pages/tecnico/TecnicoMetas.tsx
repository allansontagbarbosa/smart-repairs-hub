import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTecnicoIdentidade, useTecnicoMetricas } from "@/hooks/useTecnico";
import { Target, TrendingUp, Info } from "lucide-react";

interface MetaRow {
  id: string;
  nome: string;
  escopo: string;
  escopo_id: string | null;
  metrica: string;
  valor_alvo: number;
  valor_atual: number;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
}

export default function TecnicoMetas() {
  const { data: identidade } = useTecnicoIdentidade();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const { data: metricas } = useTecnicoMetricas(identidade?.funcionario_id, ano, mes);

  const { data: metasDoMes = [] } = useQuery<MetaRow[]>({
    queryKey: ["minhas-metas-mes", identidade?.funcionario_id, identidade?.empresa_id, ano, mes],
    enabled: !!identidade?.funcionario_id && !!identidade?.empresa_id,
    queryFn: async () => {
      const inicio = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
      const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("metas")
        .select("id, nome, escopo, escopo_id, metrica, valor_alvo, valor_atual, periodo_inicio, periodo_fim, status")
        .eq("empresa_id", identidade!.empresa_id!)
        .is("deleted_at", null)
        .eq("status", "ativa")
        .lte("periodo_inicio", fim)
        .gte("periodo_fim", inicio)
        .or(`and(escopo.eq.tecnico,escopo_id.eq.${identidade!.funcionario_id}),escopo.eq.empresa`);
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  const metasIndividuais = metasDoMes.filter(
    (m) => m.escopo === "tecnico" && m.escopo_id === identidade?.funcionario_id
  );
  const metasEmpresa = metasDoMes.filter((m) => m.escopo === "empresa");

  const metaQtdIndiv = metasIndividuais.find((m) => m.metrica === "qtd_os")?.valor_alvo ?? 0;
  const metaValIndiv = Number(metasIndividuais.find((m) => m.metrica === "faturamento")?.valor_alvo ?? 0);
  const metaQtdEmpresa = metasEmpresa.find((m) => m.metrica === "qtd_os")?.valor_alvo ?? 0;
  const metaValEmpresa = Number(metasEmpresa.find((m) => m.metrica === "faturamento")?.valor_alvo ?? 0);

  const temIndividual = metasIndividuais.length > 0;
  const temEmpresa = metasEmpresa.length > 0;

  // Se não tem individual mas tem empresa, mostramos a meta da empresa como referência (sem ratear).
  const metaQtdEfetiva = temIndividual ? Number(metaQtdIndiv) : Number(metaQtdEmpresa);
  const metaValEfetiva = temIndividual ? metaValIndiv : metaValEmpresa;
  const mostrandoEmpresaNoLugarIndiv = !temIndividual && temEmpresa;

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

      {!temIndividual && !temEmpresa ? (
        <Card><CardContent className="py-6 text-center space-y-2">
          <Target className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm">Nenhuma meta definida pelo gestor para este mês.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> {mostrandoEmpresaNoLugarIndiv ? "Meta da equipe" : "Meta individual"}
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mostrandoEmpresaNoLugarIndiv && (
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Você ainda não tem meta individual cadastrada — exibindo meta da equipe.</span>
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
          </CardContent>
        </Card>
      )}

      {temIndividual && temEmpresa && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Meta da equipe
          </CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Quantidade alvo: <strong>{metaQtdEmpresa}</strong> OS</p>
            <p>Faturamento alvo: <strong>{fmtBrl(metaValEmpresa)}</strong></p>
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
