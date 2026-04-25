import { useState } from "react";
import { X, ListChecks, UserCog, Download, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onExportCSV: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  count,
  tecnicos,
  onChangeStatus,
  onAtribuirTecnico,
  onCancelar,
  onExportCSV,
  onClear,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [tecOpen, setTecOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 bottom-4 z-40",
        "w-[calc(100%-1.5rem)] max-w-3xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
      )}
      role="region"
      aria-label="Ações em massa"
    >
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg shadow-black/10 px-3 py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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

          <Button variant="destructive" size="sm" className="h-8 gap-1.5" onClick={onCancelar}>
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
    </div>
  );
}
