import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ChevronRight,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { useFolhaMensal } from "@/hooks/useFolhaMensal";
import { useGerarFolhaMensal } from "@/hooks/useRH";
import { useEmpresaParaHolerite } from "@/hooks/useHoleriteDetalhado";
import { TIPO_VINCULO_LABELS, type TipoVinculo } from "@/types/rh";
import { supabase } from "@/integrations/supabase/client";
import { gerarHoleritesLotePDF } from "@/lib/pdf/gerarHoleritePDF";
import { toast } from "sonner";

const fmt = (c: number) =>
  (Number(c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RHFolhaMensal() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [competencia, setCompetencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );

  const { data: folha = [], isLoading } = useFolhaMensal(competencia);
  const gerarFolha = useGerarFolhaMensal();

  const totalProventos = folha.reduce((s, f) => s + f.total_proventos_centavos, 0);
  const totalDescontos = folha.reduce((s, f) => s + f.total_descontos_centavos, 0);
  const totalLiquido = folha.reduce((s, f) => s + f.liquido_centavos, 0);
  const totalPendentes = folha.reduce((s, f) => s + f.movimentacoes_pendentes, 0);
  const totalFaltas = folha.reduce((s, f) => s + f.faltas, 0);
  const funcsComMov = folha.filter(
    (f) => f.total_proventos_centavos > 0 || f.total_descontos_centavos > 0
  ).length;

  const handleGerarFolha = async () => {
    if (
      !confirm(
        `Gerar folha de ${competencia}? Lançará salários (CLT), VT e VA pra todos funcionários ativos.`
      )
    )
      return;
    try {
      const r = await gerarFolha.mutateAsync(competencia);
      toast.success(
        `Folha gerada: ${r.funcionarios_processados} funcionários, total ${fmt(
          (r.total_salarios_centavos ?? 0) +
            (r.total_vt_centavos ?? 0) +
            (r.total_va_centavos ?? 0)
        )}`
      );
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/rh")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Folha do mês</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consolidado de todos funcionários por competência
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="max-w-[180px]"
          />
          <Button onClick={handleGerarFolha} disabled={gerarFolha.isPending}>
            {gerarFolha.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Gerar folha
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Funcionários com lançamentos
              <Users className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2">
              {funcsComMov} / {folha.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Total proventos
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2">{fmt(totalProventos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Total descontos
              <AlertCircle className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2 text-destructive">
              {fmt(totalDescontos)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Total a pagar (líquido)
              <DollarSign className="h-4 w-4" />
            </div>
            <p className="text-2xl font-semibold mt-2 text-primary">{fmt(totalLiquido)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Avisos */}
      {totalPendentes > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <AlertCircle className="h-4 w-4" />
          {totalPendentes} movimentações pendentes de pagamento neste mês.
        </div>
      )}
      {totalFaltas > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
          <AlertCircle className="h-4 w-4" />
          {totalFaltas} faltas registradas neste mês.
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funcionários — {competencia}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Funcionário</th>
                    <th className="py-2 px-3 font-medium">Vínculo</th>
                    <th className="py-2 px-3 font-medium text-right">Proventos</th>
                    <th className="py-2 px-3 font-medium text-right">Descontos</th>
                    <th className="py-2 px-3 font-medium text-right">Líquido</th>
                    <th className="py-2 px-3 font-medium text-center">Faltas</th>
                    <th className="py-2 px-3 font-medium text-center">Pendentes</th>
                    <th className="py-2 pl-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {folha.map((f) => (
                    <tr
                      key={f.funcionario_id}
                      onClick={() => navigate(`/rh/${f.funcionario_id}`)}
                      className="border-t border-border hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                            {f.funcionario_nome
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{f.funcionario_nome}</p>
                            {f.cargo && (
                              <p className="text-xs text-muted-foreground truncate">
                                {f.cargo}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-xs">
                          {TIPO_VINCULO_LABELS[f.tipo_vinculo as TipoVinculo] ??
                            f.tipo_vinculo}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {f.total_proventos_centavos > 0 ? fmt(f.total_proventos_centavos) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-destructive">
                        {f.total_descontos_centavos > 0
                          ? fmt(-f.total_descontos_centavos)
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold">
                        {fmt(f.liquido_centavos)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {f.faltas > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {f.faltas}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {f.movimentacoes_pendentes > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 text-xs">
                            {f.movimentacoes_pendentes}
                          </Badge>
                        ) : (
                          <span className="text-emerald-600">✓</span>
                        )}
                      </td>
                      <td className="py-3 pl-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                  {folha.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        Nenhum funcionário com lançamentos. Use "Gerar folha" pra começar.
                      </td>
                    </tr>
                  )}
                </tbody>
                {folha.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="py-3 pr-3" colSpan={2}>
                        TOTAIS
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {fmt(totalProventos)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-destructive">
                        {fmt(-totalDescontos)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-primary">
                        {fmt(totalLiquido)}
                      </td>
                      <td className="py-3 px-3 text-center">{totalFaltas}</td>
                      <td className="py-3 px-3 text-center">{totalPendentes}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
