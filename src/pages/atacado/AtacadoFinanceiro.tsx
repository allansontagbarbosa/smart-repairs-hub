import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  DollarSign,
  AlertCircle,
  Wallet,
  ArrowRight,
  Calendar,
  Trophy,
  CheckCircle2,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function AtacadoFinanceiro() {
  const { empresaId } = useEmpresa();

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["atacado-financeiro-kpis", empresaId],
    queryFn: async () => {
      const { data } = await supabase.rpc("atacado_financeiro_kpis", {
        p_empresa_id: empresaId!,
      });
      return data?.[0];
    },
    enabled: !!empresaId,
  });

  const { data: topDevedores = [] } = useQuery({
    queryKey: ["atacado-top-devedores", empresaId],
    queryFn: async () => {
      const { data } = await supabase.rpc("atacado_top_devedores", {
        p_empresa_id: empresaId!,
        p_limit: 10,
      });
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const aReceber = Number(kpis?.a_receber_total ?? 0);
  const inadimplencia = Number(kpis?.inadimplencia_total ?? 0);
  const recebidoMes = Number(kpis?.recebido_mes ?? 0);
  const titulosVencidos = Number(kpis?.qtd_titulos_vencidos ?? 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro Atacado</h1>
        <p className="text-sm text-muted-foreground">
          Fluxo de caixa B2B, recebimentos e inadimplência
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icon={DollarSign}
              label="A receber"
              valor={formatBRL(aReceber)}
              hint="próximos 90d"
            />
            <Kpi
              icon={AlertCircle}
              label="Inadimplência"
              valor={formatBRL(inadimplencia)}
              hint={`${titulosVencidos} título(s)`}
              danger={inadimplencia > 0}
            />
            <Kpi
              icon={Wallet}
              label="Recebido no mês"
              valor={formatBRL(recebidoMes)}
            />
            <Kpi
              icon={TrendingUp}
              label="Ticket recebido"
              valor={formatBRL(Number(kpis?.ticket_medio_recebido ?? 0))}
            />
          </div>

          {/* Agenda */}
          <div className="border rounded-lg p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4" /> Agenda de recebimentos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AgendaCell
                label="Próximos 30 dias"
                valor={Number(kpis?.a_receber_30d ?? 0)}
              />
              <AgendaCell
                label="31-60 dias"
                valor={Number(kpis?.a_receber_60d ?? 0)}
              />
              <AgendaCell
                label="61-90 dias"
                valor={Number(kpis?.a_receber_90d ?? 0)}
              />
            </div>
          </div>

          {/* Top devedores */}
          <div className="border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Top 10 devedores
              </h2>
              <Link
                to="/atacado/cobranca"
                className="text-xs text-primary inline-flex items-center gap-1"
              >
                Ir pra cobrança <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {topDevedores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success" />
                Nenhum cliente em atraso. Excelente!
              </div>
            ) : (
              <div className="space-y-2">
                {topDevedores.map((d: any, i: number) => {
                  const dias = Number(d.dias_atraso_max);
                  const cls =
                    dias > 60
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : dias > 30
                      ? "bg-warning/15 text-warning border-warning/30"
                      : "bg-info/15 text-info border-info/30";
                  return (
                    <div
                      key={d.cliente_id}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-muted-foreground w-6">
                          #{i + 1}
                        </div>
                        <div>
                          <div className="font-medium">
                            {d.nome_fantasia || d.razao_social}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.cnpj ? maskCNPJ(d.cnpj) : "—"} ·{" "}
                            {d.qtd_titulos} título(s)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatBRL(Number(d.total_devido))}
                        </div>
                        <Badge variant="outline" className={`mt-1 ${cls}`}>
                          {dias}d atraso
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, valor, hint, danger }: any) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        danger ? "border-destructive/40 bg-destructive/5" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div
        className={`text-xl font-semibold mt-1 ${
          danger ? "text-destructive" : ""
        }`}
      >
        {valor}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function AgendaCell({ label, valor }: any) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{formatBRL(valor)}</div>
    </div>
  );
}
