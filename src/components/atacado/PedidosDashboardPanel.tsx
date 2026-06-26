import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  empresaId: string | null | undefined;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
  mostrarLucro?: boolean;
};

type Dash = {
  vendas: any;
  vendas_prev: any;
  rentabilidade: any;
  rentabilidade_prev: any;
  recebiveis: any;
  funil: any[];
};

function delta(atual: number, prev: number): { pct: number; up: boolean | null } {
  if (!prev) return { pct: atual ? 100 : 0, up: atual > 0 ? true : null };
  const pct = ((atual - prev) / Math.abs(prev)) * 100;
  return { pct, up: pct > 0.5 ? true : pct < -0.5 ? false : null };
}

function DeltaPill({ pct, up, inverse }: { pct: number; up: boolean | null; inverse?: boolean }) {
  const Icon = up === null ? Minus : up ? ArrowUp : ArrowDown;
  const positivo = up === null ? null : inverse ? !up : up;
  const cls =
    positivo === null
      ? "text-muted-foreground"
      : positivo
      ? "text-success"
      : "text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums", cls)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Card({
  label,
  value,
  sub,
  danger,
  intent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  danger?: boolean;
  intent?: "warning" | "success" | "info";
}) {
  const border =
    danger
      ? "border-destructive/40"
      : intent === "warning"
      ? "border-warning/40 bg-warning/5"
      : intent === "success"
      ? "border-success/40 bg-success/5"
      : intent === "info"
      ? "border-info/40 bg-info/5"
      : "border-border";
  return (
    <div className={cn("rounded-lg border p-3", border)}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold mt-0.5 tabular-nums", danger && "text-destructive")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function PedidosDashboardPanel({ empresaId, inicio, fim, mostrarLucro }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["atacado-pedidos-dashboard", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_pedidos_dashboard" as any, {
        p_empresa_id: empresaId,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data as Dash;
    },
    enabled: !!empresaId,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const v = data.vendas ?? {};
  const vp = data.vendas_prev ?? {};
  const r = data.rentabilidade ?? {};
  const rp = data.rentabilidade_prev ?? {};
  const rec = data.recebiveis ?? {};

  const dFat = delta(Number(v.faturamento_liquido || 0), Number(vp.faturamento_liquido || 0));
  const dQtd = delta(Number(v.qtd_pedidos || 0), Number(vp.qtd_pedidos || 0));
  const dTic = delta(Number(v.ticket_medio || 0), Number(vp.ticket_medio || 0));
  const dLuc = delta(Number(r.lucro_bruto || 0), Number(rp.lucro_bruto || 0));

  return (
    <div className="space-y-3">
      {/* Vendas */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
          Vendas & volume
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Card
            label="Faturamento líquido"
            value={formatBRL(Number(v.faturamento_liquido || 0))}
            sub={
              <span className="flex items-center gap-1">
                vs. anterior <DeltaPill pct={dFat.pct} up={dFat.up} />
              </span>
            }
          />
          <Card
            label="Pedidos"
            value={Number(v.qtd_pedidos || 0)}
            sub={
              <span className="flex items-center gap-1">
                vs. anterior <DeltaPill pct={dQtd.pct} up={dQtd.up} />
              </span>
            }
          />
          <Card
            label="Ticket médio"
            value={formatBRL(Number(v.ticket_medio || 0))}
            sub={
              <span className="flex items-center gap-1">
                vs. anterior <DeltaPill pct={dTic.pct} up={dTic.up} />
              </span>
            }
          />
          <Card
            label="Unidades vendidas"
            value={Number(v.unidades || 0)}
            sub={`Desc. concedidos: ${formatBRL(Number(v.descontos || 0))}`}
          />
        </div>
      </div>

      {/* Rentabilidade (apenas admin/sócio) */}
      {mostrarLucro && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
            Rentabilidade
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Card
              label="Lucro bruto"
              value={formatBRL(Number(r.lucro_bruto || 0))}
              sub={
                <span className="flex items-center gap-1">
                  vs. anterior <DeltaPill pct={dLuc.pct} up={dLuc.up} />
                </span>
              }
              danger={Number(r.lucro_bruto || 0) < 0}
            />
            <Card
              label="Margem %"
              value={`${Number(r.margem_pct || 0).toFixed(1)}%`}
              sub={`Anterior: ${Number(rp.margem_pct || 0).toFixed(1)}%`}
              danger={Number(r.margem_pct || 0) < 0}
            />
            <Card
              label="Markup médio"
              value={`${Number(r.markup_pct || 0).toFixed(1)}%`}
              sub={`Custo: ${formatBRL(Number(r.custo_total || 0))}`}
            />
            <Card
              label="Lucro / pedido"
              value={formatBRL(Number(r.lucro_medio_pedido || 0))}
              sub={`${Number(v.qtd_pedidos || 0)} pedidos no período`}
            />
          </div>
        </div>
      )}

      {/* Recebíveis */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
          Recebíveis & caixa
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Card label="A receber" value={formatBRL(Number(rec.a_receber || 0))} />
          <Card
            label="Vencido"
            value={formatBRL(Number(rec.vencido || 0))}
            danger={Number(rec.vencido || 0) > 0}
            sub={`Inadimplência: ${Number(rec.inadimplencia_pct || 0).toFixed(1)}%`}
            intent={Number(rec.vencido || 0) > 0 ? "warning" : undefined}
          />
          <Card
            label="Recebido (período)"
            value={formatBRL(Number(rec.recebido_periodo || 0))}
            intent={Number(rec.recebido_periodo || 0) > 0 ? "success" : undefined}
          />
          <Card
            label="A vencer 7 / 30 dias"
            value={formatBRL(Number(rec.a_vencer_7 || 0))}
            sub={`30 dias: ${formatBRL(Number(rec.a_vencer_30 || 0))}`}
          />
        </div>
      </div>
    </div>
  );
}
