import { useState } from "react";
import { Loader2, Wallet, Shield, TrendingUp, ArrowDownToLine, User, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePainelSocio } from "@/hooks/usePainelSocio";

const reaisToBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

const centavosToBRL = (c: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c ?? 0) / 100);

const fmtMesLabel = (ym: string) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

type Filtro = "todos" | "creditos" | "debitos" | "pro_labore";

export default function PainelSocioContas() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { data, isLoading } = usePainelSocio();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.sucesso) {
    return <div className="p-6 text-muted-foreground">Não foi possível carregar o painel.</div>;
  }

  const saldoCaixaCentavos = Number(data.saude.saldo_caixa_centavos ?? 0);
  const gastosFixosCentavos = Number(data.saude.gastos_fixos_mes_centavos ?? 0);
  const diasRunway = Number(data.saude.dias_runway ?? 0);
  const mesesCobertura = gastosFixosCentavos > 0 ? (saldoCaixaCentavos / gastosFixosCentavos).toFixed(1) : "—";

  const distribuivel = Number(data.mes_atual.distribuivel ?? 0);
  const socios = data.socios || [];
  const historico = data.historico || [];
  const temHistorico = historico.some((h) => Number(h.lucro_liquido) > 0);

  // Próximo mês a fechar (mês anterior)
  const hoje = new Date();
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnteriorYM = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link
              to="/painel-socio"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3 w-3 mr-1" /> Voltar ao Painel
            </Link>
            <h1 className="text-3xl font-bold tracking-tight mt-1">Contas &amp; Caixa</h1>
            <p className="text-sm text-muted-foreground">
              Saldos da empresa, reserva e conta corrente de cada sócio
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button disabled>Fechar mês {fmtMesLabel(mesAnteriorYM)}</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Em desenvolvimento — Fase 2</TooltipContent>
          </Tooltip>
        </div>

        {/* SEÇÃO 1 — Caixa da Empresa */}
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Caixa da empresa</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <TrendingUp className="h-3 w-3" /> Lucro a distribuir
                </div>
                <div className="text-3xl font-bold mt-2 tabular-nums">
                  {reaisToBRL(distribuivel)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Crédito disponível para distribuição extraordinária
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-sky-500">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <Wallet className="h-3 w-3" /> Caixa operacional
                </div>
                <div className="text-3xl font-bold mt-2 tabular-nums">
                  {centavosToBRL(saldoCaixaCentavos)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cobre {mesesCobertura} {mesesCobertura === "1.0" ? "mês" : "meses"} · {diasRunway} dias de runway
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-violet-500">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <Shield className="h-3 w-3" /> Reserva de emergência
                </div>
                <div className="text-3xl font-bold mt-2 tabular-nums">
                  {reaisToBRL(0)}
                </div>
                <Progress value={0} className="h-1.5 mt-3" />
                <div className="text-xs text-muted-foreground mt-1 italic">
                  Em desenvolvimento — disponível em breve
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SEÇÃO 2 — Sócios */}
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Contas dos sócios</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {socios.map((s) => (
              <Card key={s.id} className={s.eh_voce ? "ring-1 ring-primary/40" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{s.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(s.percentual || 0).toFixed(2)}% participação
                        </div>
                      </div>
                    </div>
                    {s.eh_voce && (
                      <Badge variant="secondary" className="text-[10px]">VOCÊ</Badge>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Saldo a retirar
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {reaisToBRL(0)}
                    </div>
                    <div className="text-[11px] text-muted-foreground italic mt-0.5">
                      Em desenvolvimento
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Creditado no ano: {reaisToBRL(s.valor_ano_acumulado)} · Retirado: {reaisToBRL(0)}
                    </div>
                  </div>

                  {s.eh_voce && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="block">
                          <Button size="sm" className="w-full" disabled>
                            <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                            Retirar
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Em desenvolvimento — Fase 2</TooltipContent>
                    </Tooltip>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SEÇÃO 3 — Extrato do sócio logado */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
              Meu extrato · {data.socio?.nome}
            </h2>
            <div className="flex gap-1 text-xs">
              {(["todos", "creditos", "debitos", "pro_labore"] as Filtro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    filtro === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {f === "todos" && "Todos"}
                  {f === "creditos" && "Créditos"}
                  {f === "debitos" && "Débitos"}
                  {f === "pro_labore" && "Pró-labore"}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Nenhuma movimentação ainda.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* SEÇÃO 4 — Fechamentos mensais */}
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Fechamentos mensais</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Lucro líquido</TableHead>
                    <TableHead className="text-right">Meu valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!temHistorico && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        Nenhum mês fechado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {temHistorico &&
                    historico.map((h) => (
                      <TableRow key={h.mes}>
                        <TableCell className="font-medium">{fmtMesLabel(h.mes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{reaisToBRL(h.faturamento)}</TableCell>
                        <TableCell className="text-right tabular-nums">{reaisToBRL(h.lucro_liquido)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {reaisToBRL(h.meu_valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}
