import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpisFinanceiros } from "@/components/painel-socio/KpisFinanceiros";
import { DistribuicaoLucros, SocioDist } from "@/components/painel-socio/DistribuicaoLucros";
import { CaixaRunway } from "@/components/painel-socio/CaixaRunway";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function ComboPainelSocio() {
  const { empresaId } = useEmpresa();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data: combo } = useQuery({
    queryKey: ["combo-painel-socio", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("combo_dashboard_kpis", {
        p_empresa_id: empresaId!,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!empresaId,
  });

  const fatLoja = Number(combo?.faturamento_loja ?? 0);
  const fatAssist = Number(combo?.faturamento_assist ?? 0);
  const total = Number(combo?.faturamento_total ?? fatLoja + fatAssist);
  const vendasLoja = Number(combo?.vendas_loja_qtd ?? 0);
  const osAssist = Number(combo?.os_assist_qtd ?? 0);

  // Lucro: simplificado — margem média 25% até despesas detalhadas serem integradas.
  const lucroLiquido = total * 0.25;
  const ebitda = lucroLiquido;
  const margemPct = total > 0 ? (lucroLiquido / total) * 100 : 0;

  const { data: socios = [] } = useQuery<SocioDist[]>({
    queryKey: ["socios-combo", empresaId, lucroLiquido],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("socios")
        .select("id, nome, percentual_participacao")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("ordem");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        nome: s.nome,
        pct: Number(s.percentual_participacao),
        cota: (lucroLiquido * Number(s.percentual_participacao)) / 100,
        retirado: 0,
      }));
    },
    enabled: !!empresaId,
  });

  const saude =
    lucroLiquido <= 0
      ? { label: "Crítica", nivel: 1 as const }
      : margemPct < 10
      ? { label: "Atenção", nivel: 2 as const }
      : margemPct < 20
      ? { label: "Regular", nivel: 3 as const }
      : margemPct < 30
      ? { label: "Saudável", nivel: 4 as const }
      : { label: "Excelente", nivel: 5 as const };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Painel do Sócio · Combo
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Visão executiva unificada
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            Loja + Assistência ·{" "}
            {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          Visão combinada
        </Badge>
      </div>

      <KpisFinanceiros
        faturamento={total}
        ebitda={ebitda}
        ebitdaMargem={margemPct}
        lucroLiquido={lucroLiquido}
        lucroMargem={margemPct}
        saudeLabel={saude.label}
        saudeNivel={saude.nivel}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quebra de receita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Linha label="🛒 Loja" value={brl(fatLoja)} />
            <Linha label="🔧 Assistência" value={brl(fatAssist)} />
            <div className="pt-2 mt-2 border-t">
              <Linha label="Total" value={brl(total)} strong />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Linha label="Vendas (Loja)" value={String(vendasLoja)} />
            <Linha label="OSs concluídas (Assist)" value={String(osAssist)} />
            <div className="pt-2 mt-2 border-t">
              <Linha label="Total de transações" value={String(vendasLoja + osAssist)} strong />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <DistribuicaoLucros
          socios={socios}
          lucroLiquido={lucroLiquido}
          reservaEmergencia={lucroLiquido * 0.2}
        />
        <CaixaRunway saldoCaixa={0} saldoBanco={0} burnRate={total - lucroLiquido} metaReservaMeses={6} />
      </div>
    </div>
  );
}

function Linha({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
