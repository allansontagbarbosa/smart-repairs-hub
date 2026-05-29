import { Download, Calendar, Store, Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function ComboDashboard() {
  const { empresaId } = useEmpresa();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data: kpis } = useQuery({
    queryKey: ["combo-dashboard-kpis", empresaId, inicio, fim],
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

  const fatLoja = Number(kpis?.faturamento_loja ?? 0);
  const fatAssist = Number(kpis?.faturamento_assistencia ?? 0);
  const total = Number(kpis?.faturamento_total ?? fatLoja + fatAssist);
  const vendasLoja = Number(kpis?.vendas_loja ?? 0);
  const osAssist = Number(kpis?.os_concluidas ?? 0);
  const pctLoja = total > 0 ? (fatLoja / total) * 100 : 0;
  const pctAssist = total > 0 ? (fatAssist / total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Dashboard Combinado
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Operação unificada
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            Loja + Assistência · {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Período
          </Button>
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-0">
        <CardContent className="p-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">
              Faturamento total do mês
            </div>
            <div className="text-4xl md:text-5xl font-bold mt-2">{brl(total)}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Quebra
              icon={<Store className="h-4 w-4" />}
              label="Loja (varejo)"
              valor={fatLoja}
              pct={pctLoja}
              qtdLabel={`${vendasLoja} vendas`}
            />
            <Quebra
              icon={<Wrench className="h-4 w-4" />}
              label="Assistência técnica"
              valor={fatAssist}
              pct={pctAssist}
              qtdLabel={`${osAssist} OSs`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Vendas Loja" value={String(vendasLoja)} />
        <Kpi label="OSs concluídas" value={String(osAssist)} />
        <Kpi
          label="Ticket médio Loja"
          value={vendasLoja > 0 ? brl(fatLoja / vendasLoja) : brl(0)}
        />
        <Kpi
          label="Ticket médio Assist"
          value={osAssist > 0 ? brl(fatAssist / osAssist) : brl(0)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Atalho
          to="/loja/pdv"
          icon={<Zap className="h-5 w-5" />}
          title="Nova venda (Loja)"
          desc="Abrir PDV — F1"
        />
        <Atalho
          to="/assistencia/nova"
          icon={<Wrench className="h-5 w-5" />}
          title="Nova OS (Assistência)"
          desc="Abrir fluxo de assistência"
        />
      </div>
    </div>
  );
}

function Quebra({
  icon,
  label,
  valor,
  pct,
  qtdLabel,
}: {
  icon: React.ReactNode;
  label: string;
  valor: number;
  pct: number;
  qtdLabel: string;
}) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="opacity-75 text-xs">· {qtdLabel}</span>
        </span>
        <span className="text-xs opacity-90">{pct.toFixed(1)}%</span>
      </div>
      <div className="text-2xl font-bold">{brl(valor)}</div>
      <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full bg-primary-foreground transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Atalho({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors p-5 flex items-center gap-4"
    >
      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </Link>
  );
}
