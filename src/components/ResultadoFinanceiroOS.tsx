import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissoes } from "@/hooks/usePermissoes";
import { cn } from "@/lib/utils";

interface Props {
  ordem: any;
  /** Soma das despesas vinculadas a esta OS (calculada no parent). */
  totalDespesasVinculadas?: number;
  /** Soma do custo terceirizado dos serviços (motivo_sem_tecnico = 'terceirizado'), calculada no parent. */
  totalTerceirizado?: number;
  /** Soma real das comissões já lançadas para esta OS (preferida sobre custo_mao_de_obra). */
  totalComissoesReais?: number;
  /** Quantidade de peças utilizadas registradas (para alerta de auditoria). */
  qtdPecasUtilizadas?: number;
  /** Quantidade de comissões já lançadas (para alerta de auditoria). */
  qtdComissoes?: number;
}

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

/**
 * Card "Resultado Financeiro" da OS — visível apenas para perfis Admin / Financeiro.
 * Mostra valor cobrado, custo das peças (média ponderada congelada),
 * comissão do técnico, despesas vinculadas e lucro/margem calculados.
 *
 * Fórmula:
 *   Lucro = Valor cobrado − Custo peças − Comissão − Despesas vinculadas
 */
export function ResultadoFinanceiroOS({
  ordem,
  totalDespesasVinculadas = 0,
  totalComissoesReais,
  qtdPecasUtilizadas = 0,
  qtdComissoes = 0,
}: Props) {
  const { perfil, isAdmin } = usePermissoes();

  const perfilNorm = (perfil || "").toLowerCase();
  const podeVer =
    isAdmin ||
    perfilNorm === "admin" ||
    perfilNorm === "administrador" ||
    perfilNorm === "financeiro";

  if (!podeVer || !ordem) return null;

  const valorServicos = Number(ordem.valor_total_servicos ?? 0);
  const valorPecas = Number(ordem.valor_total_pecas ?? 0);
  const maoObraAdic = Number(ordem.mao_obra_adicional ?? 0);
  const desconto = Number(ordem.desconto ?? 0);
  // O cliente paga valor_total (já inclui mão de obra adicional e desconto).
  // Fallback ordem: valor_total → valor (compat com OS antigas) → valor_total_servicos (último recurso).
  const valorServicoCobrado = Number(
    ordem.valor_total ?? ordem.valor ?? ordem.valor_total_servicos ?? 0
  );
  const custoPecas = Number(ordem.custo_pecas ?? 0);
  // Prioriza soma real de comissões já lançadas. Se ainda não há comissões
  // lançadas (OS antes de "Pronto"), mostra a comissão prevista calculada
  // pelo backend (snapshot custo_mao_de_obra).
  const snapshotComissao = Number(ordem.custo_mao_de_obra ?? 0);
  const temComissoesReais =
    typeof totalComissoesReais === "number" && qtdComissoes > 0;
  const comissao = temComissoesReais
    ? (totalComissoesReais as number)
    : snapshotComissao;
  const comissaoPrevista = !temComissoesReais && snapshotComissao > 0;
  const despesas = Number(totalDespesasVinculadas ?? 0);

  const valorCobradoBruto = valorServicos + maoObraAdic;
  const lucro = valorServicoCobrado - custoPecas - comissao - despesas;
  const margem = valorServicoCobrado > 0 ? (lucro / valorServicoCobrado) * 100 : null;
  const lucroPositivo = lucro >= 0;

  // Alerta de auditoria: tem comissão mas zero peças e zero custo de peças
  const status = String(ordem.status ?? "");
  const statusRelevante = ["pronto", "entregue", "em_reparo"].includes(status);
  const mostrarAlertaSemPecas =
    statusRelevante &&
    custoPecas === 0 &&
    qtdPecasUtilizadas === 0 &&
    qtdComissoes > 0;

  // Aviso para OSs antigas: peças cobradas sem custo registrado
  const temPecasSemCusto = valorPecas > 0 && custoPecas === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {lucroPositivo ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            Resultado financeiro
            <Badge variant="outline" className="ml-auto text-[10px] font-normal">
              Visível só para você
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Linha label="Serviços" valor={valorServicos} />
          <Linha label="Peças cobradas" valor={valorPecas} />
          {maoObraAdic > 0 && <Linha label="Mão de obra adicional" valor={maoObraAdic} />}
          {desconto > 0 && (
            <Linha label="Desconto" valor={-desconto} className="text-muted-foreground" />
          )}

          <div className="border-t border-border/60 my-2" />

          <Linha
            label={
              <span className="inline-flex items-center gap-1">
                Valor cobrado
                <span className="text-[11px] text-muted-foreground">
                  (= {brl(valorCobradoBruto)} {desconto > 0 ? `− ${brl(desconto)}` : ""})
                </span>
              </span>
            }
            valor={valorServicoCobrado}
            className="font-medium"
          />

          <Linha
            label={
              <span className="inline-flex items-center gap-1">
                (−) Custo das peças
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px]">
                    Custo médio ponderado da peça no momento em que foi adicionada
                    a esta OS. Não muda quando você compra mais peças depois.
                  </TooltipContent>
                </Tooltip>
              </span>
            }
            valor={-custoPecas}
            className="text-destructive"
          />

          <Linha
            label={
              <span className="inline-flex items-center gap-1">
                (−) Comissão do técnico
                {comissaoPrevista && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (prevista)
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px]">
                    Calculada conforme o tipo de comissão configurado para o
                    técnico responsável (percentual, fixo por OS, etc.).
                  </TooltipContent>
                </Tooltip>
              </span>
            }
            valor={-comissao}
            className="text-destructive"
          />

          <Linha
            label="(−) Despesas vinculadas"
            valor={-despesas}
            className="text-destructive"
          />

          <div className="border-t border-border/60 my-2" />

          {mostrarAlertaSemPecas && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Nenhuma peça registrada — confirme se foi serviço puro.</span>
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="font-semibold">Lucro</span>
            <div className="flex items-center gap-2">
              <Badge
                variant={lucroPositivo ? "default" : "destructive"}
                className={cn(
                  "tabular-nums",
                  lucroPositivo
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                    : ""
                )}
              >
                {brl(lucro)}
              </Badge>
              <Badge variant="outline" className="text-[11px] tabular-nums">
                {margem === null ? "—" : `${margem.toFixed(1)}%`}
              </Badge>
            </div>
          </div>

          {temPecasSemCusto && (
            <p className="text-[11px] text-amber-600 dark:text-amber-500 flex items-start gap-1.5 pt-2 border-t border-border/60 mt-2">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                OSs anteriores à implementação do custo médio podem ter lucro
                impreciso porque o custo das peças não foi rastreado no momento
                do uso.
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function Linha({
  label,
  valor,
  className,
}: {
  label: React.ReactNode;
  valor: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{brl(valor)}</span>
    </div>
  );
}
