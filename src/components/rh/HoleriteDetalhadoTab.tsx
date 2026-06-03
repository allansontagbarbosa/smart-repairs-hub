import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useHoleriteDetalhado,
  useMontarHolerite,
  useEmpresaParaHolerite,
  type HoleriteEventoRow,
} from "@/hooks/useHoleriteDetalhado";
import { baixarHoleritePDF } from "@/lib/pdf/gerarHoleritePDF";

const fmt = (c: number) =>
  (Number(c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCompetencia = (ym: string) => {
  const [y, m] = ym.split("-");
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${meses[parseInt(m, 10) - 1]} / ${y}`;
};

interface Props {
  funcionarioId: string;
  competencia: string;
  setCompetencia: (v: string) => void;
}

export function HoleriteDetalhadoTab({ funcionarioId, competencia, setCompetencia }: Props) {
  const { data: holerite, isLoading, refetch } = useHoleriteDetalhado(funcionarioId, competencia);
  const { data: empresa } = useEmpresaParaHolerite();
  const montar = useMontarHolerite();

  const proventos = useMemo<HoleriteEventoRow[]>(
    () => (holerite?.eventos ?? []).filter((e) => e.tipo === "provento"),
    [holerite],
  );
  const descontos = useMemo<HoleriteEventoRow[]>(
    () => (holerite?.eventos ?? []).filter((e) => e.tipo === "desconto"),
    [holerite],
  );
  const semEventos = (holerite?.eventos ?? []).length === 0;

  const handleMontar = async () => {
    try {
      await montar.mutateAsync({ funcionario_id: funcionarioId, competencia });
      await refetch();
      toast.success("Holerite montado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao montar holerite");
    }
  };

  const handleBaixarPDF = () => {
    if (!holerite) return;
    try {
      baixarHoleritePDF({
        empresa: empresa ?? { nome: "Empresa" },
        funcionario: holerite.funcionario,
        competencia,
        eventos: holerite.eventos,
        total_proventos_centavos: holerite.total_proventos_centavos,
        total_descontos_centavos: holerite.total_descontos_centavos,
        liquido_centavos: holerite.liquido_centavos,
        horas_trabalhadas: holerite.horas_trabalhadas,
        dias_trabalhados: holerite.dias_trabalhados,
        faltas: holerite.faltas,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium">Competência:</label>
        <input
          type="month"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        />
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleMontar}
          disabled={montar.isPending}
        >
          {montar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          Montar holerite
        </Button>
        <Button size="sm" onClick={handleBaixarPDF} disabled={!holerite || semEventos}>
          <Download className="h-4 w-4 mr-2" />
          Baixar PDF
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && holerite && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle>Holerite — {fmtCompetencia(competencia)}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {holerite.funcionario.nome}
                  {holerite.funcionario.cargo ? ` · ${holerite.funcionario.cargo}` : ""}
                  {holerite.funcionario.tipo_vinculo ? ` · ${holerite.funcionario.tipo_vinculo.toUpperCase()}` : ""}
                </p>
              </div>
              {empresa?.nome && (
                <Badge variant="outline" className="text-xs">{empresa.nome}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {semEventos ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum evento nesta competência.
                <br />
                Clique em <strong>"Montar holerite"</strong> para gerar a partir do cadastro,
                comissões, ponto e movimentações.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PROVENTOS */}
                  <div>
                    <div className="text-xs font-bold tracking-wider mb-2 text-emerald-700 dark:text-emerald-400">
                      PROVENTOS
                    </div>
                    <div className="border rounded-md divide-y">
                      {proventos.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground">—</div>
                      )}
                      {proventos.map((e) => (
                        <div key={e.id} className="px-3 py-2 flex justify-between items-baseline gap-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate">{e.descricao}</div>
                            {e.referencia && (
                              <div className="text-[10px] text-muted-foreground">{e.referencia}</div>
                            )}
                          </div>
                          <div className="tabular-nums font-medium">{fmt(e.valor_centavos)}</div>
                        </div>
                      ))}
                      <div className="px-3 py-2 flex justify-between bg-muted/40 font-semibold text-sm">
                        <span>Total proventos</span>
                        <span className="tabular-nums">{fmt(holerite.total_proventos_centavos)}</span>
                      </div>
                    </div>
                  </div>

                  {/* DESCONTOS */}
                  <div>
                    <div className="text-xs font-bold tracking-wider mb-2 text-red-700 dark:text-red-400">
                      DESCONTOS
                    </div>
                    <div className="border rounded-md divide-y">
                      {descontos.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground">—</div>
                      )}
                      {descontos.map((e) => (
                        <div key={e.id} className="px-3 py-2 flex justify-between items-baseline gap-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate">{e.descricao}</div>
                            {e.referencia && (
                              <div className="text-[10px] text-muted-foreground">{e.referencia}</div>
                            )}
                          </div>
                          <div className="tabular-nums font-medium text-destructive">
                            {fmt(e.valor_centavos)}
                          </div>
                        </div>
                      ))}
                      <div className="px-3 py-2 flex justify-between bg-muted/40 font-semibold text-sm">
                        <span>Total descontos</span>
                        <span className="tabular-nums text-destructive">
                          {fmt(holerite.total_descontos_centavos)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Espaço reservado para INSS / IRRF / FGTS (cálculo fiscal — em breve).
                    </div>
                  </div>
                </div>

                {/* Líquido */}
                <div className="rounded-md border-2 border-primary/30 bg-primary/5 px-4 py-3 flex justify-between items-center">
                  <span className="font-bold tracking-wide">LÍQUIDO A RECEBER</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {fmt(holerite.liquido_centavos)}
                  </span>
                </div>

                {/* Rodapé indicadores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="border rounded-md p-2">
                    <div className="text-muted-foreground">Horas trabalhadas</div>
                    <div className="font-semibold mt-1">
                      {Number(holerite.horas_trabalhadas ?? 0).toFixed(1)}h
                    </div>
                  </div>
                  <div className="border rounded-md p-2">
                    <div className="text-muted-foreground">Dias trabalhados</div>
                    <div className="font-semibold mt-1">{holerite.dias_trabalhados ?? 0}</div>
                  </div>
                  <div className="border rounded-md p-2">
                    <div className="text-muted-foreground">Faltas</div>
                    <div className="font-semibold mt-1">{holerite.faltas ?? 0}</div>
                  </div>
                  <div className="border rounded-md p-2">
                    <div className="text-muted-foreground">Base FGTS (info)</div>
                    <div className="font-semibold mt-1 text-muted-foreground">—</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
