import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, Hash, AlertCircle, FileX, Loader2, ChevronRight } from "lucide-react";
import {
  useResumoPrejuizos,
  usePrejuizosPorTipo,
  useListarPrejuizos,
} from "@/hooks/usePrejuizos";
import { TipoPrejuizo, TIPO_PREJUIZO_COR } from "@/types/prejuizo";
import { ModalCriarPrejuizo } from "./ModalCriarPrejuizo";
import { ModalDetalhePrejuizo } from "./ModalDetalhePrejuizo";
import { cn } from "@/lib/utils";

const fmtBRL = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => new Date(s).toLocaleDateString("pt-BR");

export default function PrejuizosTab() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(inicioMes.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));
  const [filtroTipo, setFiltroTipo] = useState<TipoPrejuizo | null>(null);
  const [showCriar, setShowCriar] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { data: resumo } = useResumoPrejuizos(dataInicio, dataFim);
  const { data: porTipo = [] } = usePrejuizosPorTipo(dataInicio, dataFim);
  const { data: lista, isLoading } = useListarPrejuizos({
    data_inicio: dataInicio,
    data_fim: dataFim,
    tipo: filtroTipo,
  });

  const totalCentavos = resumo?.periodo.total_centavos ?? 0;
  const variacao = resumo?.variacao_pct ?? null;

  return (
    <div className="space-y-5">
      {/* Header com filtros e botão */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Prejuízos</h2>
          <p className="text-sm text-muted-foreground">
            Garantias, fraudes, perdas e outros prejuízos operacionais
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-muted-foreground">
            De
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Até
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </label>
          <Button onClick={() => setShowCriar(true)} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Novo prejuízo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total no período</span>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-destructive">
            {fmtBRL(totalCentavos)}
          </div>
          {variacao !== null && (
            <div className="text-xs mt-1">
              <span className={variacao > 0 ? "text-red-600" : "text-green-600"}>
                {variacao > 0 ? "+" : ""}
                {variacao}%
              </span>
              <span className="text-muted-foreground"> vs período anterior</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Quantidade</span>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold mt-2">
            {resumo?.periodo.qtd ?? 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            prejuízos registrados
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tipo principal</span>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-base font-semibold mt-2 truncate">
            {porTipo[0]?.tipo_label ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {porTipo[0]
              ? `${fmtBRL(porTipo[0].total_centavos)} (${porTipo[0].qtd}x)`
              : "Sem dados"}
          </div>
        </div>
      </div>

      {/* Filtro por tipo - chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroTipo(null)}
          className={cn(
            "px-3 py-1 rounded-full border text-xs transition-colors",
            !filtroTipo
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted"
          )}
        >
          Todos {lista?.total ? `(${lista.total})` : ""}
        </button>
        {porTipo.map((t) => (
          <button
            key={t.tipo}
            onClick={() => setFiltroTipo(t.tipo)}
            className={cn(
              "px-3 py-1 rounded-full border text-xs transition-colors",
              filtroTipo === t.tipo
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            {t.tipo_label} ({t.qtd})
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
                <th className="text-left px-4 py-2.5 font-medium">OS</th>
                <th className="text-left px-4 py-2.5 font-medium">Origem</th>
                <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline" />
                  </td>
                </tr>
              )}
              {!isLoading && lista?.prejuizos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    <FileX className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum prejuízo no período. Bom sinal!
                  </td>
                </tr>
              )}
              {lista?.prejuizos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setDetalheId(p.id)}
                  className="border-t border-border hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {fmtData(p.data_evento)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 rounded-full text-[11px] border",
                        TIPO_PREJUIZO_COR[p.tipo]
                      )}
                    >
                      {p.tipo_label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-xs truncate">
                    {p.descricao || "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {p.os_origem
                      ? `#${p.os_origem.numero}`
                      : p.os_retrabalho
                      ? `#${p.os_retrabalho.numero}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.origem === "manual" ? (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Automático
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-destructive">
                    {fmtBRL(p.valor_centavos)}
                  </td>
                  <td className="px-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      {showCriar && <ModalCriarPrejuizo onClose={() => setShowCriar(false)} />}
      {detalheId && (
        <ModalDetalhePrejuizo id={detalheId} onClose={() => setDetalheId(null)} />
      )}
    </div>
  );
}
