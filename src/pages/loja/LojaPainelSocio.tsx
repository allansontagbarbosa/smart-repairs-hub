import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpisFinanceiros } from "@/components/painel-socio/KpisFinanceiros";
import { DistribuicaoLucros, SocioDist } from "@/components/painel-socio/DistribuicaoLucros";
import { CaixaRunway } from "@/components/painel-socio/CaixaRunway";

export default function LojaPainelSocio() {
  const { empresaId } = useEmpresa();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data: kpis } = useQuery({
    queryKey: ["loja-painel-socio-kpis", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("loja_dashboard_kpis", {
        p_empresa_id: empresaId!,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!empresaId,
  });

  const faturamento = Number(kpis?.faturamento ?? 0);
  const lucroBruto = Number(kpis?.lucro_bruto ?? 0);
  const margem = Number(kpis?.margem ?? 0);
  // Sem despesas operacionais detalhadas ainda: EBITDA ≈ Lucro Bruto.
  const ebitda = lucroBruto;
  const lucroLiquido = lucroBruto;

  const { data: socios = [] } = useQuery<SocioDist[]>({
    queryKey: ["socios-loja-painel", empresaId, lucroLiquido],
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
      : margem < 10
      ? { label: "Atenção", nivel: 2 as const }
      : margem < 20
      ? { label: "Regular", nivel: 3 as const }
      : margem < 30
      ? { label: "Saudável", nivel: 4 as const }
      : { label: "Excelente", nivel: 5 as const };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Painel do Sócio · Loja
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Visão executiva do varejo
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          Apenas Loja
        </Badge>
      </div>

      <KpisFinanceiros
        faturamento={faturamento}
        ebitda={ebitda}
        ebitdaMargem={margem}
        lucroLiquido={lucroLiquido}
        lucroMargem={margem}
        saudeLabel={saude.label}
        saudeNivel={saude.nivel}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <DistribuicaoLucros
          socios={socios}
          lucroLiquido={lucroLiquido}
          reservaEmergencia={lucroLiquido * 0.2}
        />
        <CaixaRunway
          saldoCaixa={0}
          saldoBanco={0}
          burnRate={Number(kpis?.custo_total ?? 0)}
          metaReservaMeses={6}
        />
      </div>
    </div>
  );
}
