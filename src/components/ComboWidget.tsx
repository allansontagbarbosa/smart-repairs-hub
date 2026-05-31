import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Sparkles, Wrench, Store, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useModulos } from "@/hooks/useModulos";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ComboKPIs {
  faturamento_assist: number;
  faturamento_loja: number;
  faturamento_atacado: number;
  qtd_os: number;
  qtd_vendas_loja: number;
  qtd_pedidos_atacado: number;
  ticket_medio_consolidado: number;
}

interface Props {
  /** Renderiza versão compacta (1 linha de KPIs, expansível) */
  compact?: boolean;
  /** Posição: 'top' (acima de tudo) ou 'inline' (dentro do conteúdo) */
  variant?: "top" | "inline";
}

export function ComboWidget({ compact = false }: Props) {
  const { empresaId } = useEmpresa();
  const { can } = usePermissoes();
  const [expanded, setExpanded] = useState(!compact);

  if (!can("ver_combo", "ver")) return null;

  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["combo-kpis", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("combo_dashboard_kpis", {
        p_empresa_id: empresaId!,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return (data?.[0] as ComboKPIs | undefined) ?? undefined;
    },
    enabled: !!empresaId,
  });

  const fatAssist = Number(kpis?.faturamento_assist ?? 0);
  const fatLoja = Number(kpis?.faturamento_loja ?? 0);
  const fatAtacado = Number(kpis?.faturamento_atacado ?? 0);
  const total = fatAssist + fatLoja + fatAtacado;
  const pctAssist = total > 0 ? (fatAssist / total) * 100 : 0;
  const pctLoja = total > 0 ? (fatLoja / total) * 100 : 0;
  const pctAtacado = total > 0 ? (fatAtacado / total) * 100 : 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mb-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-8 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full bg-gradient-to-r from-primary/5 via-info/5 to-warning/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center justify-between hover:border-primary/40 transition-all group"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Visão Combo · Total do mês
            </div>
            <div className="text-base font-bold text-foreground">{formatBRL(total)}</div>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-info/5 to-warning/5 p-5 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Visão Combo</span>
          <span className="text-xs text-muted-foreground capitalize">
            · {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
        </div>
        {compact && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="h-7 px-2">
            <ChevronUp className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Faturamento total consolidado
        </div>
        <div className="text-3xl font-bold text-foreground mt-1">{formatBRL(total)}</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Modulo
          icon={<Wrench className="h-3.5 w-3.5" />}
          label="Assistência"
          corBg="bg-info"
          valor={fatAssist}
          pct={pctAssist}
          qtd={Number(kpis?.qtd_os ?? 0)}
          qtdLabel="OS concluídas"
          link="/dashboard"
        />
        <Modulo
          icon={<Store className="h-3.5 w-3.5" />}
          label="Loja"
          corBg="bg-primary"
          valor={fatLoja}
          pct={pctLoja}
          qtd={Number(kpis?.qtd_vendas_loja ?? 0)}
          qtdLabel="vendas"
          link="/loja/dashboard"
        />
        <Modulo
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Atacado"
          corBg="bg-warning"
          valor={fatAtacado}
          pct={pctAtacado}
          qtd={Number(kpis?.qtd_pedidos_atacado ?? 0)}
          qtdLabel="pedidos"
          link="/atacado/dashboard"
        />
      </div>
    </div>
  );
}

function Modulo({
  icon,
  label,
  corBg,
  valor,
  pct,
  qtd,
  qtdLabel,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  corBg: string;
  valor: number;
  pct: number;
  qtd: number;
  qtdLabel: string;
  link: string;
}) {
  return (
    <Link
      to={link}
      className="block rounded-lg bg-card border border-border p-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {icon}
          {label}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {qtd} {qtdLabel}
        </span>
      </div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-lg font-bold text-foreground">{formatBRL(valor)}</span>
        <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${corBg} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}
