import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissoes } from "@/hooks/usePermissoes";
import { cn } from "@/lib/utils";

interface Props {
  ordem: any;
}

const fmtBRL = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Card "Resultado Financeiro" da OS — visível apenas para perfis Admin / Financeiro.
 * Mostra valor cobrado, custo das peças (média ponderada congelada),
 * comissão do técnico e lucro/margem calculados.
 */
export function ResultadoFinanceiroOS({ ordem }: Props) {
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
  const valorTotal = Number(ordem.valor_total ?? ordem.valor ?? 0);
  const custoPecas = Number(ordem.custo_pecas ?? 0);
  const custoMaoObra = Number(ordem.custo_mao_de_obra ?? 0);
  const lucro = Number(ordem.lucro_bruto ?? 0);
  const margem = Number(ordem.margem_calculada ?? 0);

  const lucroPositivo = lucro >= 0;
  const valorCobrado = valorServicos + valorPecas + maoObraAdic;

  // Aviso para OSs antigas: peças sem custo registrado
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
                  (= {fmtBRL(valorCobrado)} {desconto > 0 ? `− ${fmtBRL(desconto)}` : ""})
                </span>
              </span>
            }
            valor={valorTotal}
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

          {custoMaoObra > 0 && (
            <Linha
              label={
                <span className="inline-flex items-center gap-1">
                  (−) Comissão do técnico
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
              valor={-custoMaoObra}
              className="text-destructive"
            />
          )}

          <div className="border-t border-border/60 my-2" />

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
                {fmtBRL(lucro)}
              </Badge>
              {valorTotal > 0 && (
                <Badge variant="outline" className="text-[11px] tabular-nums">
                  {margem.toFixed(1)}%
                </Badge>
              )}
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
      <span className="tabular-nums">{fmtBRL(valor)}</span>
    </div>
  );
}
