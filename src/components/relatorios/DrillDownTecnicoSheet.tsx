import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useComissoesTecnicoPeriodo, type ComissaoDetalhe } from "@/hooks/useDesempenhoTecnicos";

const brl = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "border-amber-300 bg-amber-50 text-amber-700" },
  liberada: { label: "Liberada", className: "border-blue-300 bg-blue-50 text-blue-700" },
  paga: { label: "Paga", className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  estornada: { label: "Estornada", className: "border-red-300 bg-red-50 text-red-700" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  funcionarioId: string | null;
  funcionarioNome: string;
  inicio: Date;
  fim: Date;
}

export function DrillDownTecnicoSheet({
  open,
  onOpenChange,
  funcionarioId,
  funcionarioNome,
  inicio,
  fim,
}: Props) {
  const { data: comissoes = [], isLoading } = useComissoesTecnicoPeriodo(
    open ? funcionarioId : null,
    inicio,
    fim,
  );

  const totais = {
    qtd: comissoes.length,
    pendente: comissoes.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0),
    liberada: comissoes.filter((c) => c.status === "liberada").reduce((s, c) => s + Number(c.valor), 0),
    paga: comissoes.filter((c) => c.status === "paga").reduce((s, c) => s + Number(c.valor), 0),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{funcionarioNome}</SheetTitle>
          <SheetDescription>
            Comissões de {format(inicio, "dd/MM", { locale: ptBR })} a{" "}
            {format(fim, "dd/MM/yyyy", { locale: ptBR })}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-2 my-4">
          <Stat label="Itens" value={String(totais.qtd)} />
          <Stat label="Pendente" value={brl(totais.pendente)} className="text-amber-700" />
          <Stat label="Liberada" value={brl(totais.liberada)} className="text-blue-700" />
          <Stat label="Paga" value={brl(totais.paga)} className="text-emerald-700" />
        </div>

        <div className="space-y-2">
          {isLoading && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Carregando...
            </div>
          )}
          {!isLoading && comissoes.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Sem comissões no período.
            </div>
          )}
          {!isLoading &&
            comissoes.map((c: ComissaoDetalhe) => {
              const sv = STATUS_VARIANT[c.status] ?? STATUS_VARIANT.pendente;
              return (
                <div key={c.comissao_id} className="border border-border rounded-lg p-3 hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        OS #{c.os_numero_formatado || c.os_numero || "—"}
                      </div>
                      <p className="text-sm font-medium truncate">{c.servico_nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.aparelho?.trim() || "—"}
                        {c.cliente_nome ? ` · ${c.cliente_nome}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={sv.className}>
                      {sv.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-muted-foreground">
                      {c.mes_competencia ?? format(new Date(c.created_at), "MMM/yyyy", { locale: ptBR })}
                      {c.data_pagamento
                        ? ` · pago em ${format(new Date(c.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}`
                        : ""}
                    </span>
                    <span className="font-semibold tabular-nums">{brl(c.valor)}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="border border-border rounded-md p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${className ?? ""}`}>{value}</p>
    </div>
  );
}
