import { useState, useMemo } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDesempenhoTecnicos, type KpiTecnico } from "@/hooks/useDesempenhoTecnicos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Wrench, DollarSign, TrendingUp, Loader2, Receipt } from "lucide-react";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PERIODOS = [
  {
    id: "semana",
    label: "Esta semana",
    range: () => ({
      inicio: startOfWeek(new Date(), { locale: ptBR }),
      fim: endOfWeek(new Date(), { locale: ptBR }),
    }),
  },
  {
    id: "mes",
    label: "Este mês",
    range: () => ({ inicio: startOfMonth(new Date()), fim: endOfMonth(new Date()) }),
  },
  {
    id: "30d",
    label: "Últimos 30 dias",
    range: () => ({ inicio: subDays(new Date(), 30), fim: new Date() }),
  },
] as const;

export default function DesempenhoTecnicos() {
  const [periodo, setPeriodo] = useState<string>("mes");
  const range = useMemo(
    () => PERIODOS.find((p) => p.id === periodo)!.range(),
    [periodo],
  );
  const { data: tecnicos = [], isLoading } = useDesempenhoTecnicos(range.inicio, range.fim);

  const totais = useMemo(
    () => ({
      qtd_servicos: tecnicos.reduce((s, t) => s + Number(t.qtd_servicos), 0),
      qtd_os: tecnicos.reduce((s, t) => s + Number(t.qtd_os), 0),
      faturamento: tecnicos.reduce((s, t) => s + Number(t.faturamento_os), 0),
      a_receber: tecnicos.reduce((s, t) => s + Number(t.comissao_total_a_receber), 0),
      paga: tecnicos.reduce((s, t) => s + Number(t.comissao_paga), 0),
    }),
    [tecnicos],
  );

  const lider = tecnicos[0];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="page-title">Desempenho dos técnicos</h1>
          <p className="page-subtitle">
            {format(range.inicio, "dd/MM/yyyy", { locale: ptBR })} –{" "}
            {format(range.fim, "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={periodo === p.id ? "default" : "outline"}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <CardKpi icon={Wrench} label="Serviços" value={String(totais.qtd_servicos)} />
        <CardKpi icon={Receipt} label="OS atendidas" value={String(totais.qtd_os)} />
        <CardKpi icon={DollarSign} label="Faturamento" value={brl(totais.faturamento)} />
        <CardKpi icon={TrendingUp} label="Comissão a receber" value={brl(totais.a_receber)} />
        <CardKpi icon={DollarSign} label="Comissão paga" value={brl(totais.paga)} accent />
      </div>

      {lider && lider.comissao_total_a_receber > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-full bg-primary/10 p-3">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Líder do período
              </p>
              <p className="text-lg font-semibold">{lider.nome}</p>
              <p className="text-sm text-muted-foreground">
                {lider.qtd_servicos} serviços · {brl(lider.comissao_total_a_receber)} a receber
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento por técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-2">Técnico</th>
                  <th className="text-right">Serviços</th>
                  <th className="text-right">OS</th>
                  <th className="text-right">Faturamento</th>
                  <th className="text-right">Ticket médio</th>
                  <th className="text-right">Pendente</th>
                  <th className="text-right">Liberada</th>
                  <th className="text-right">Paga</th>
                  <th className="text-right">A receber</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && tecnicos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      Nenhum dado no período.
                    </td>
                  </tr>
                )}
                {tecnicos.map((t: KpiTecnico, i) => (
                  <tr key={t.funcionario_id} className="border-t border-border">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {i === 0 && t.comissao_total_a_receber > 0 && (
                          <Trophy className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="font-medium">{t.nome}</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{t.qtd_servicos}</td>
                    <td className="text-right tabular-nums">{t.qtd_os}</td>
                    <td className="text-right tabular-nums">{brl(Number(t.faturamento_os))}</td>
                    <td className="text-right tabular-nums">{brl(Number(t.ticket_medio_os))}</td>
                    <td className="text-right tabular-nums text-warning">
                      {brl(Number(t.comissao_pendente))}
                    </td>
                    <td className="text-right tabular-nums text-info">
                      {brl(Number(t.comissao_liberada))}
                    </td>
                    <td className="text-right tabular-nums text-success">
                      {brl(Number(t.comissao_paga))}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {brl(Number(t.comissao_total_a_receber))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CardKpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card ${accent ? "border-success/20 bg-success-muted" : ""}`}>
      <Icon className={`h-4 w-4 mb-2 ${accent ? "text-success" : "text-muted-foreground"}`} />
      <p className="stat-label">{label}</p>
      <p className={`stat-value text-lg ${accent ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}
