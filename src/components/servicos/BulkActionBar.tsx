import { useState } from "react";
import { X, ListChecks, UserCog, Download, ChevronDown, Trash2, AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { statusLabels, type Status } from "@/lib/status";
import { formatNumeroOS } from "@/lib/numeroOS";

/**
 * Status disponíveis para mudança em massa.
 * "cancelado" é INTENCIONALMENTE omitido — cancelamento usa fluxo individual com auditoria própria.
 */
const STATUS_BULK: Status[] = [
  "recebido",
  "em_analise",
  "aguardando_aprovacao",
  "aprovado",
  "em_reparo",
  "aguardando_peca",
  "pronto",
  "entregue",
];

export interface TecnicoOption {
  id: string;
  nome: string;
}

interface Props {
  count: number;
  tecnicos: TecnicoOption[];
  onChangeStatus: (status: Status) => void;
  onAtribuirTecnico: (funcionarioId: string, nome: string) => void;
  onCancelar: () => void;
  cancelDisabled?: boolean;
  cancelBlockedItems?: { id: string; numero: string | number; numero_formatado?: string | null; motivo: string }[];
  onExportCSV: () => void;
  onMarcarPagas?: () => void;
  onEditarDatas?: () => void;
  onClear: () => void;
  /** Totalizadores agregados das OS selecionadas. Quando ausente, a linha de totais não é renderizada. */
  totais?: {
    valor_total: number;
    custo_pecas: number;
    custo_comissao: number;
    lucro: number;
    margem: number;
    ticket_medio: number;
    por_status: Record<string, number>;
  };
}

export function BulkActionBar({
  count,
  tecnicos,
  onChangeStatus,
  onAtribuirTecnico,
  onCancelar,
  cancelDisabled = false,
  cancelBlockedItems = [],
  onExportCSV,
  onMarcarPagas,
  onClear,
  totais,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [tecOpen, setTecOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 bottom-4 z-40",
        "w-[calc(100%-1.5rem)] max-w-5xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
      )}
      role="region"
      aria-label="Ações em massa"
    >
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg shadow-black/10 px-3 py-2.5 flex flex-col gap-2">
        {cancelBlockedItems.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              {cancelBlockedItems.length} OS selecionada{cancelBlockedItems.length === 1 ? "" : "s"} não pode{cancelBlockedItems.length === 1 ? "" : "m"} ser cancelada{cancelBlockedItems.length === 1 ? "" : "s"}: {cancelBlockedItems
                .slice(0, 4)
                .map((item) => `#${formatNumeroOS(item.numero, item.numero_formatado)} — ${item.motivo}`)
                .join("; ")}
              {cancelBlockedItems.length > 4 ? `; + ${cancelBlockedItems.length - 4} outra${cancelBlockedItems.length - 4 === 1 ? "" : "s"}` : ""}. Remova da seleção para liberar o cancelamento.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-2 sm:min-w-[160px]">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            ✓
          </span>
          <span className="text-sm font-medium">
            {count} OS selecionada{count === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 sm:justify-center">
          {/* Mudar status */}
          <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Mudar status
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-xs">Novo status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_BULK.map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="text-xs"
                  onClick={() => {
                    setStatusOpen(false);
                    onChangeStatus(s);
                  }}
                >
                  {statusLabels[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Atribuir técnico */}
          <DropdownMenu open={tecOpen} onOpenChange={setTecOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <UserCog className="h-3.5 w-3.5" />
                Atribuir técnico
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56 max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-xs">Técnicos ativos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tecnicos.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  Nenhum técnico ativo cadastrado
                </div>
              ) : (
                tecnicos.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    className="text-xs"
                    onClick={() => {
                      setTecOpen(false);
                      onAtribuirTecnico(t.id, t.nome);
                    }}
                  >
                    {t.nome}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Exportar CSV */}
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onExportCSV}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>

          {/* Marcar como pagas */}
          {onMarcarPagas && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onMarcarPagas}>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Marcar pagas
            </Button>
          )}

          <Button variant="destructive" size="sm" className="h-8 gap-1.5" onClick={onCancelar} disabled={cancelDisabled}>
            <Trash2 className="h-3.5 w-3.5" />
            Cancelar OSs
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClear}
          aria-label="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </Button>
        </div>

        {totais && (
          <div className="border-t border-border/60 pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1.5">
            <Stat label="Valor total" value={formatCurrency(totais.valor_total)} accent />
            <Stat label="Custo peças" value={formatCurrency(totais.custo_pecas)} muted />
            <Stat label="Comissão" value={formatCurrency(totais.custo_comissao)} muted />
            <Stat label="Lucro" value={formatCurrency(totais.lucro)} tone={totais.lucro >= 0 ? "positive" : "negative"} />
            <Stat label="Margem" value={`${totais.margem.toFixed(1)}%`} tone={totais.lucro >= 0 ? "positive" : "negative"} />
            <Stat label="Ticket médio" value={formatCurrency(totais.ticket_medio)} />
          </div>
        )}

        {totais && Object.keys(totais.por_status).length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(totais.por_status).map(([status, n]) => (
              <Badge key={status} variant="secondary" className="text-[11px] font-normal">
                {(statusLabels as any)[status] ?? status}: {n}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
  tone?: "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-primary"
      : tone === "negative"
      ? "text-destructive"
      : accent
      ? "text-foreground"
      : muted
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
