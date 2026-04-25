import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Plus, Search, Loader2, LayoutGrid, MessageCircle,
  ChevronRight, CheckCircle, Truck, AlertTriangle, Clock,
  CircleDot, ArrowUpDown, RefreshCw, Package, Wrench,
  CalendarClock, Printer, Brain, Shield, Trash2, XCircle,
  X, SlidersHorizontal, Download, ChevronDown, MoreVertical, ArrowUp, ArrowDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { useAlertas } from "@/hooks/useAlertas";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { calcularPrioridade, type Prioridade } from "@/lib/prioridade";
import { statusFlow, statusLabels, type Status } from "@/lib/status";
import { differenceInDays, format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { printEtiquetaOS } from "@/lib/printEtiqueta";
import { GarantiasTab } from "@/components/GarantiasTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissoes } from "@/hooks/usePermissoes";
import { CancelarOSDialog } from "@/components/CancelarOSDialog";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { HeaderCheckbox, RowCheckbox } from "@/components/SelectableCheckbox";
import { BulkActionBar, type TecnicoOption } from "@/components/servicos/BulkActionBar";
import { BulkActionConfirmDialog, type BulkAffectedItem } from "@/components/BulkActionConfirmDialog";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type SortKey = "numero" | "prioridade" | "data_entrada" | "valor";
type SortDir = "asc" | "desc";
type StatusFilter = Status | "todos";
type PeriodPreset = "30" | "60" | "90" | "all";
type DateRangeFilter = { de?: string; ate?: string } | null;
type PeriodFilterState = { preset: PeriodPreset | null; de?: string; ate?: string; key: string; dateRange: DateRangeFilter };
type GarantiaFilter = "em_garantia" | "expirada" | "sem_garantia";
type OrderFilters = {
  cliente_id?: string;
  funcionario_id?: string;
  marca?: string;
  modelo?: string;
  prioridade?: string;
  garantia?: GarantiaFilter;
  aprovacao?: string;
};

const prioridadeConfig: Record<Prioridade, { color: string; bg: string; icon: any }> = {
  critica: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: AlertTriangle },
  atencao: { color: "text-warning", bg: "bg-warning/10 border-warning/30", icon: Clock },
  normal: { color: "text-success", bg: "bg-success/10 border-success/30", icon: CircleDot },
};

const prioOrder: Record<Prioridade, number> = { critica: 0, atencao: 1, normal: 2 };
const LIST_PAGE_SIZE = 30;
const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Todo o período" },
];
const PRIORIDADE_OPTIONS = ["normal"];
const APROVACAO_OPTIONS = ["aprovado", "pendente", "aguardando"];
const GARANTIA_OPTIONS: { value: GarantiaFilter; label: string }[] = [
  { value: "em_garantia", label: "Em garantia" },
  { value: "expirada", label: "Expirada" },
  { value: "sem_garantia", label: "Sem garantia" },
];

// ─── DATA FETCH ───────────────────────────────────────────────────────────────

function dateOnly(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function dateStartIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function dateEndIso(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function applyDateRange<T extends ReturnType<typeof supabase.from>>(query: any, dateRange: DateRangeFilter): T {
  if (!dateRange) return query;
  if (dateRange.de) query = query.gte("data_entrada", dateStartIso(dateRange.de));
  if (dateRange.ate) query = query.lte("data_entrada", dateEndIso(dateRange.ate));
  return query;
}

function filterHash(filters: OrderFilters) {
  return JSON.stringify(Object.keys(filters).sort().reduce((acc, key) => {
    const value = filters[key as keyof OrderFilters];
    if (value) acc[key] = value;
    return acc;
  }, {} as Record<string, string>));
}

function getFiltersFromParams(params: URLSearchParams): OrderFilters {
  return {
    cliente_id: params.get("cliente_id") || undefined,
    funcionario_id: params.get("funcionario_id") || undefined,
    marca: params.get("marca") || undefined,
    modelo: params.get("modelo") || undefined,
    prioridade: params.get("prioridade") || undefined,
    garantia: (params.get("garantia") as GarantiaFilter | null) || undefined,
    aprovacao: params.get("aprovacao") || undefined,
  };
}

function applyOrderFilters<T extends ReturnType<typeof supabase.from>>(query: any, filters: OrderFilters): T {
  if (filters.cliente_id) query = query.eq("aparelhos.cliente_id", filters.cliente_id);
  if (filters.funcionario_id) query = query.eq("funcionario_id", filters.funcionario_id);
  if (filters.marca) query = query.eq("aparelhos.marca", filters.marca);
  if (filters.modelo) query = query.eq("aparelhos.modelo", filters.modelo);
  if (filters.prioridade) query = query.eq("prioridade", filters.prioridade);
  if (filters.aprovacao) query = query.eq("aprovacao_orcamento", filters.aprovacao);
  if (filters.garantia === "em_garantia") {
    query = query.gt("garantia_dias", 0).not("data_entrega", "is", null).gte("data_entrega", dateOnly(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)));
  } else if (filters.garantia === "expirada") {
    query = query.gt("garantia_dias", 0).not("data_entrega", "is", null).lt("data_entrega", dateOnly(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)));
  } else if (filters.garantia === "sem_garantia") {
    query = query.or("garantia_dias.eq.0,data_entrega.is.null");
  }
  return query;
}

function getPeriodFromParams(params: URLSearchParams): PeriodFilterState {
  const de = params.get("de") || undefined;
  const ate = params.get("ate") || undefined;
  if (de || ate) {
    return { preset: null, de, ate, key: `custom:${de ?? ""}:${ate ?? ""}`, dateRange: { de, ate } };
  }

  const periodo = params.get("periodo") as PeriodPreset | null;
  const preset: PeriodPreset = periodo && ["30", "60", "90", "all"].includes(periodo) ? periodo : "90";
  if (preset === "all") {
    return { preset, key: "all", dateRange: null };
  }

  const from = new Date();
  from.setDate(from.getDate() - Number(preset));
  const dePreset = dateOnly(from);
  return { preset, de: dePreset, key: preset, dateRange: { de: dePreset } };
}

async function fetchOrders({ page, filterStatus, dateRange, filters }: { page: number; filterStatus: StatusFilter; dateRange: DateRangeFilter; filters: OrderFilters }) {
  const start = page * LIST_PAGE_SIZE;
  const end = start + LIST_PAGE_SIZE - 1;

  let query = supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos!inner ( marca, modelo, imei, capacidade, cliente_id, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false })
    .range(start, end);

  query = applyDateRange(query, dateRange);
  query = applyOrderFilters(query, filters);

  if (filterStatus !== "todos") {
    query = query.eq("status", filterStatus);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function fetchOrdersCount({ filterStatus, dateRange, filters }: { filterStatus: StatusFilter; dateRange: DateRangeFilter; filters: OrderFilters }) {
  let query = supabase
    .from("ordens_de_servico")
    .select("*, aparelhos!inner(cliente_id, marca, modelo)", { count: "exact", head: true });

  query = applyDateRange(query, dateRange);
  query = applyOrderFilters(query, filters);

  if (filterStatus !== "todos") {
    query = query.eq("status", filterStatus);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function fetchStatusCounts({ dateRange }: { dateRange: DateRangeFilter }) {
  let query = supabase
    .from("ordens_de_servico")
    .select("status");

  query = applyDateRange(query, dateRange);

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = { todos: 0 };
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    counts.todos += 1;
  }
  return counts;
}

async function fetchOrdersForExport({ filterStatus, dateRange, filters }: { filterStatus: StatusFilter; dateRange: DateRangeFilter; filters: OrderFilters }) {
  const batchSize = 1000;
  let start = 0;
  const rows: any[] = [];

  while (true) {
    let query = supabase
      .from("ordens_de_servico")
      .select(`*, aparelhos!inner ( marca, modelo, imei, capacidade, cliente_id, clientes ( nome, telefone ) ), funcionarios ( nome ), formas_pagamento ( nome )`)
      .order("data_entrada", { ascending: false })
      .range(start, start + batchSize - 1);

    query = applyDateRange(query, dateRange);
    query = applyOrderFilters(query, filters);

    if (filterStatus !== "todos") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < batchSize) break;
    start += batchSize;
  }

  return rows;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number | null) {
  if (!v) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatDateExport(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatMoneyExport(v: number | null) {
  if (v == null) return "";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatExportFilename(ext: "csv" | "xlsx") {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  return `ordens_de_servico_${stamp}.${ext}`;
}

function garantiaStatus(row: any) {
  const dias = Number(row.garantia_dias ?? 0);
  if (!dias || !row.data_entrega) return "Sem garantia";
  const fim = new Date(row.data_entrega);
  fim.setDate(fim.getDate() + dias);
  return fim >= new Date() ? "Em garantia" : "Expirada";
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toExportRows(rows: any[]) {
  return rows.map((row) => ({
    "Número": row.numero_formatado || `#${String(row.numero).padStart(3, "0")}`,
    "Data Entrada": formatDateExport(row.data_entrada),
    "Status": statusLabels[row.status as Status] ?? row.status ?? "",
    "Prioridade": row.prioridade ?? "",
    "Cliente": row.aparelhos?.clientes?.nome ?? "",
    "Telefone": row.aparelhos?.clientes?.telefone ?? "",
    "Aparelho": [row.aparelhos?.marca, row.aparelhos?.modelo].filter(Boolean).join(" "),
    "IMEI": row.aparelhos?.imei ?? "",
    "Defeito Relatado": row.defeito_relatado ?? "",
    "Diagnóstico": row.diagnostico ?? "",
    "Serviço Realizado": row.servico_realizado ?? "",
    "Técnico": row.tecnico || row.funcionarios?.nome || "",
    "Valor Total": formatMoneyExport(row.valor_total ?? row.valor),
    "Forma de Pagamento": row.formas_pagamento?.nome || row.forma_pagamento_id || "",
    "Aprovação Orçamento": row.aprovacao_orcamento ?? "",
    "Data Conclusão": formatDateExport(row.data_conclusao),
    "Data Entrega": formatDateExport(row.data_entrega),
    "Garantia": garantiaStatus(row),
  }));
}

function grupoData(dataEntrada: string): string {
  const d = new Date(dataEntrada);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  if (isThisWeek(d, { locale: ptBR })) return "Esta semana";
  return format(d, "MMMM yyyy", { locale: ptBR });
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function PrioridadeBadge({ nivel, motivo }: { nivel: Prioridade; motivo: string }) {
  const cfg = prioridadeConfig[nivel];
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
          <Icon className="h-3 w-3" />
          {nivel === "critica" ? "Urgente" : nivel === "atencao" ? "Atenção" : "OK"}
        </span>
      </TooltipTrigger>
      <TooltipContent>{motivo}</TooltipContent>
    </Tooltip>
  );
}

function PrazoTag({ previsao, status }: { previsao: string | null; status: string }) {
  if (!previsao || status === "entregue" || status === "pronto") return null;
  const dias = differenceInDays(new Date(previsao), new Date());
  if (dias < 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium">
        <AlertTriangle className="h-3 w-3" /> {Math.abs(dias)}d atraso
      </span>
    );
  if (dias === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium">
        <Clock className="h-3 w-3" /> vence hoje
      </span>
    );
  if (dias <= 2)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium">
        <CalendarClock className="h-3 w-3" /> {dias}d restante{dias > 1 ? "s" : ""}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <CalendarClock className="h-3 w-3" /> {formatDate(previsao)}
    </span>
  );
}

function PecasPendentesTag({ temPeca }: { temPeca: boolean }) {
  if (!temPeca) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-medium">
          <Package className="h-3 w-3" /> peça pendente
        </span>
      </TooltipTrigger>
      <TooltipContent>Aguardando chegada de peça</TooltipContent>
    </Tooltip>
  );
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "recebido", label: "Recebido" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_aprovacao", label: "Aprovação" },
  { value: "em_reparo", label: "Em reparo" },
  { value: "aguardando_peca", label: "Aguard. peça" },
  { value: "pronto", label: "Pronto" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

function getPeriodLabel(period: PeriodFilterState) {
  if (period.preset) return PERIOD_PRESETS.find((preset) => preset.value === period.preset)?.label ?? "Período";
  if (period.de && period.ate) return `${formatDate(period.de)} – ${formatDate(period.ate)}`;
  if (period.de) return `Desde ${formatDate(period.de)}`;
  if (period.ate) return `Até ${formatDate(period.ate)}`;
  return "Período";
}

function StatusTabs({
  counts,
  active,
  onChange,
}: {
  counts: Record<string, number>;
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto border-b-[0.5px] border-border/70 scrollbar-hide">
      {STATUS_TABS.map((chip) => {
        const count = counts[chip.value] ?? 0;
        const isActive = active === chip.value;
        return (
          <button
            key={chip.value}
            onClick={() => onChange(chip.value)}
            className={`shrink-0 inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {chip.label}
            <span className="text-[12px] font-normal text-muted-foreground">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function FiltroPeriodo({
  period,
  onPresetChange,
  onCustomChange,
}: {
  period: PeriodFilterState;
  onPresetChange: (preset: PeriodPreset) => void;
  onCustomChange: (range: { de?: string; ate?: string }) => void;
}) {
  const selectedRange = {
    from: period.de ? new Date(`${period.de}T00:00:00`) : undefined,
    to: period.ate ? new Date(`${period.ate}T00:00:00`) : undefined,
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        {PERIOD_PRESETS.map((preset) => {
          const isActive = period.preset === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => onPresetChange(preset.value)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label="De"
          value={period.de ?? ""}
          onChange={(e) => onCustomChange({ de: e.target.value || undefined, ate: period.ate })}
          className="h-8 w-[135px] text-xs"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          aria-label="Até"
          value={period.ate ?? ""}
          onChange={(e) => onCustomChange({ de: period.de, ate: e.target.value || undefined })}
          className="h-8 w-[135px] text-xs"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <CalendarClock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={selectedRange}
              onSelect={(range) =>
                onCustomChange({
                  de: range?.from ? dateOnly(range.from) : undefined,
                  ate: range?.to ? dateOnly(range.to) : undefined,
                })
              }
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function FiltrosAvancados({
  filters,
  clienteSearch,
  setClienteSearch,
  clientes,
  funcionarios,
  marcas,
  modelos,
  onSetFilter,
  onClearAll,
}: {
  filters: OrderFilters;
  clienteSearch: string;
  setClienteSearch: (value: string) => void;
  clientes: { id: string; nome: string; telefone: string | null }[];
  funcionarios: { id: string; nome: string }[];
  marcas: string[];
  modelos: string[];
  onSetFilter: (key: keyof OrderFilters, value?: string) => void;
  onClearAll: () => void;
}) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,720px)] p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Filtros avançados</h3>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 text-xs">
                Limpar todos os filtros
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <Input
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                placeholder="Buscar cliente"
                className="h-9 text-sm"
              />
              {clientes.length > 0 && (
                <div className="max-h-36 overflow-auto rounded-md border border-border bg-background">
                  {clientes.map((cliente) => (
                    <button
                      key={cliente.id}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        onSetFilter("cliente_id", cliente.id);
                        setClienteSearch(cliente.nome);
                      }}
                    >
                      <span className="font-medium text-foreground">{cliente.nome}</span>
                      <span className="block text-muted-foreground">{cliente.telefone ?? "Sem telefone"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <FilterSelect label="Técnico/Funcionário" value={filters.funcionario_id} onChange={(v) => onSetFilter("funcionario_id", v)}>
              {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </FilterSelect>

            <FilterSelect label="Marca" value={filters.marca} onChange={(v) => onSetFilter("marca", v)}>
              {marcas.map((marca) => <option key={marca} value={marca}>{marca}</option>)}
            </FilterSelect>

            <FilterSelect label="Modelo" value={filters.modelo} onChange={(v) => onSetFilter("modelo", v)} disabled={!filters.marca}>
              {modelos.map((modelo) => <option key={modelo} value={modelo}>{modelo}</option>)}
            </FilterSelect>

            <FilterSelect label="Prioridade" value={filters.prioridade} onChange={(v) => onSetFilter("prioridade", v)}>
              {PRIORIDADE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterSelect>

            <FilterSelect label="Garantia" value={filters.garantia} onChange={(v) => onSetFilter("garantia", v)}>
              {GARANTIA_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </FilterSelect>

            <FilterSelect label="Aprovação" value={filters.aprovacao} onChange={(v) => onSetFilter("aprovacao", v)}>
              {APROVACAO_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </FilterSelect>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value?: string;
  onChange: (value?: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Todos</option>
        {children}
      </select>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Assistencia() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("todos");
  const [filterPrioridade, setFilterPrioridade] = useState<"todas" | Prioridade>("todas");
  const [sortKey, setSortKey] = useState<SortKey>("data_entrada");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [agrupar, setAgrupar] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [clienteSearch, setClienteSearch] = useState("");
  const [debouncedClienteSearch, setDebouncedClienteSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Bulk action: confirmação pendente
  type PendingBulk =
    | { kind: "status"; status: Status }
    | { kind: "tecnico"; funcionarioId: string; nome: string }
    | null;
  const [pendingBulk, setPendingBulk] = useState<PendingBulk>(null);

  const queryClient = useQueryClient();
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();
  const { can, isAdmin } = usePermissoes();
  const period = useMemo(() => getPeriodFromParams(searchParams), [searchParams]);
  const filters = useMemo(() => getFiltersFromParams(searchParams), [searchParams]);
  const filtersKey = useMemo(() => filterHash(filters), [filters]);

  useEffect(() => {
    const status = searchParams.get("status");
    setFilterStatus((status || "todos") as StatusFilter);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedClienteSearch(clienteSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [clienteSearch]);

  const { data: recentResult, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ordens", "page", page, "status", filterStatus, "periodo", period.key, "filtros", filtersKey],
    queryFn: () => fetchOrders({ page, filterStatus, dateRange: period.dateRange, filters }),
    placeholderData: (previousData) => previousData,
  });

  const { data: totalOrders = 0 } = useQuery({
    queryKey: ["ordens-count", "status", filterStatus, "periodo", period.key, "filtros", filtersKey],
    queryFn: () => fetchOrdersCount({ filterStatus, dateRange: period.dateRange, filters }),
  });

  const { data: statusCounts = { todos: 0 } } = useQuery({
    queryKey: ["ordens", "status-counts", "periodo", period.key],
    queryFn: () => fetchStatusCounts({ dateRange: period.dateRange }),
  });

  const { data: clientesFiltro = [] } = useQuery({
    queryKey: ["clientes-filtro-os", debouncedClienteSearch],
    queryFn: async () => {
      if (debouncedClienteSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .ilike("nome", `%${debouncedClienteSearch}%`)
        .is("deleted_at", null)
        .order("nome")
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: funcionariosFiltro = [] } = useQuery({
    queryKey: ["funcionarios-filtro-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: marcasFiltro = [] } = useQuery({
    queryKey: ["aparelhos-marcas-filtro-os"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aparelhos").select("marca").order("marca");
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((item) => item.marca).filter(Boolean))).sort();
    },
  });

  const { data: modelosFiltro = [] } = useQuery({
    queryKey: ["aparelhos-modelos-filtro-os", filters.marca],
    queryFn: async () => {
      if (!filters.marca) return [];
      const { data, error } = await supabase
        .from("aparelhos")
        .select("modelo")
        .eq("marca", filters.marca)
        .order("modelo");
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((item) => item.modelo).filter(Boolean))).sort();
    },
  });

  // Fetch active guarantees for "Em garantia" badge
  const { data: garantiasAtivas = [] } = useQuery({
    queryKey: ["garantias-ativas"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("garantias")
        .select("ordem_id, data_fim, status")
        .eq("status", "ativa")
        .gte("data_fim", hoje);
      return data ?? [];
    },
  });

  const garantiaOrdemIds = useMemo(() => new Set(garantiasAtivas.map(g => g.ordem_id)), [garantiasAtivas]);

  const orders = useMemo(() => {
    return recentResult ?? [];
  }, [recentResult]);

  const alertas = useAlertas(orders);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const updates: any = { status };
      if (status === "entregue") updates.data_entrega = new Date().toISOString();
      if (status === "pronto") updates.data_conclusao = new Date().toISOString();
      const { error } = await supabase.from("ordens_de_servico").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── BULK ACTIONS — só carrega técnicos se admin ───────────────────────────
  const { data: tecnicos = [] } = useQuery<TecnicoOption[]>({
    queryKey: ["funcionarios-tecnicos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, funcao, cargo")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      const isTecnico = (s?: string | null) =>
        !!s && /tecn/i.test(s);
      return (data ?? [])
        .filter((f: any) => isTecnico(f.funcao) || isTecnico(f.cargo))
        .map((f: any) => ({ id: f.id, nome: f.nome }));
    },
    enabled: isAdmin,
  });

  const handleWhatsApp = (phone: string | undefined, orderNum: number) => {
    if (!phone) return toast.error("Cliente sem telefone cadastrado");
    abrirWhatsApp(phone, `Olá! Informamos sobre a OS #${String(orderNum).padStart(3, "0")}. Por favor, entre em contato conosco.`);
  };

  const getNextStatus = (current: Status): Status | null => {
    const idx = statusFlow.indexOf(current);
    if (idx < 0 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
  };

  // ── ENRICH + FILTRO + SORT ────────────────────────────────────────────────

  const enriched = useMemo(() =>
    orders.map((o) => ({
      ...o,
      prioridade: calcularPrioridade(o.status, o.data_entrada, o.previsao_entrega),
      temPecaPendente: o.status === "aguardando_peca",
    })),
    [orders]
  );

  const filtered = useMemo(() => {
    return enriched.filter((o) => {
      const clientName = o.aparelhos?.clientes?.nome ?? "";
      const clientPhone = o.aparelhos?.clientes?.telefone ?? "";
      const device = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        clientName.toLowerCase().includes(q) ||
        clientPhone.includes(q) ||
        device.toLowerCase().includes(q) ||
        String(o.numero).includes(q);
      const matchStatus =
        filterStatus === "todos"
          ? true
          : o.status === filterStatus;
      const matchPrioridade =
        filterPrioridade === "todas" || o.prioridade.nivel === filterPrioridade;
      return matchSearch && matchStatus && matchPrioridade;
    });
  }, [enriched, search, filterStatus, filterPrioridade]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "numero") cmp = Number(a.numero ?? 0) - Number(b.numero ?? 0);
      else if (sortKey === "prioridade") cmp = prioOrder[a.prioridade.nivel] - prioOrder[b.prioridade.nivel];
      else if (sortKey === "data_entrada")
        cmp = new Date(a.data_entrada).getTime() - new Date(b.data_entrada).getTime();
      else if (sortKey === "valor") {
        cmp = (Number(a.valor) || 0) - (Number(b.valor) || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / LIST_PAGE_SIZE));
  const paginatedSorted = sorted;
  const firstVisible = totalOrders === 0 ? 0 : page * LIST_PAGE_SIZE + 1;
  const lastVisible = Math.min((page * LIST_PAGE_SIZE) + paginatedSorted.length, totalOrders);

  useEffect(() => {
    setPage(0);
  }, [filterStatus, filterPrioridade, search, sortKey, sortDir, period.key, filtersKey]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  // ── BULK SELECTION ────────────────────────────────────────────────────────
  // Itens selecionáveis = a página atual visível (sorted)
  const bulk = useBulkSelection(isAdmin ? paginatedSorted : undefined);

  // Limpa seleção quando filtro/busca muda
  useEffect(() => {
    bulk.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterPrioridade, search, page, period.key, filtersKey]);

  const affectedItems: BulkAffectedItem[] = useMemo(
    () =>
      bulk.selectedItems.map((o: any) => ({
        id: o.id,
        numero: o.numero,
        cliente: o.aparelhos?.clientes?.nome ?? "—",
        aparelho: [o.aparelhos?.marca, o.aparelhos?.modelo].filter(Boolean).join(" "),
      })),
    [bulk.selectedItems],
  );

  // Helper: exibe toast com motivos de itens ignorados
  const showBulkResultToast = (atualizadas: number, ignoradas: number, motivos: any[]) => {
    if (ignoradas === 0) {
      toast.success(`✅ ${atualizadas} OS atualizada${atualizadas === 1 ? "" : "s"} com sucesso`);
      return;
    }
    toast.message(`✅ ${atualizadas} atualizada${atualizadas === 1 ? "" : "s"}, ⚠️ ${ignoradas} ignorada${ignoradas === 1 ? "" : "s"}`, {
      description:
        motivos && motivos.length > 0
          ? motivos
              .slice(0, 5)
              .map((m: any) => `#${String(m.numero).padStart(3, "0")} — ${m.motivo}`)
              .join("\n") + (motivos.length > 5 ? `\n+ ${motivos.length - 5} outras` : "")
          : undefined,
      duration: 8000,
    });
  };

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: Status) => {
      const ids = Array.from(bulk.selectedIds);
      const { data, error } = await supabase.rpc("bulk_atualizar_status_os" as any, {
        p_ordem_ids: ids,
        p_novo_status: status,
      });
      if (error) throw error;
      return data as { atualizadas: number; ignoradas: number; motivos_ignoradas: any[] };
    },
    onSuccess: (res) => {
      showBulkResultToast(res.atualizadas, res.ignoradas, res.motivos_ignoradas);
      bulk.clear();
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      setPendingBulk(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPendingBulk(null);
    },
  });

  const bulkTecnicoMutation = useMutation({
    mutationFn: async ({ funcionarioId }: { funcionarioId: string }) => {
      const ids = Array.from(bulk.selectedIds);
      const { data, error } = await supabase.rpc("bulk_atribuir_tecnico_os" as any, {
        p_ordem_ids: ids,
        p_funcionario_id: funcionarioId,
      });
      if (error) throw error;
      return data as { atualizadas: number; ignoradas: number; motivos_ignoradas: any[]; tecnico_nome: string };
    },
    onSuccess: (res) => {
      showBulkResultToast(res.atualizadas, res.ignoradas, res.motivos_ignoradas);
      bulk.clear();
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      setPendingBulk(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPendingBulk(null);
    },
  });

  const handleConfirmBulk = async () => {
    if (!pendingBulk) return;
    if (pendingBulk.kind === "status") {
      await bulkStatusMutation.mutateAsync(pendingBulk.status);
    } else if (pendingBulk.kind === "tecnico") {
      await bulkTecnicoMutation.mutateAsync({ funcionarioId: pendingBulk.funcionarioId });
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    setIsExporting(true);
    try {
      const exportData = await fetchOrdersForExport({ filterStatus, dateRange: period.dateRange, filters });
      if (exportData.length === 0) {
        toast.error("Nenhuma OS encontrada para exportar");
        return;
      }

      const rows = toExportRows(exportData);
      if (format === "csv") {
        downloadCsv(formatExportFilename("csv"), rows);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ordens");
        XLSX.writeFile(wb, formatExportFilename("xlsx"));
      }
      toast.success(`${exportData.length} OS exportada${exportData.length > 1 ? "s" : ""}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao exportar ordens");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePeriodPresetChange = (preset: PeriodPreset) => {
    const next = new URLSearchParams(searchParams);
    next.delete("de");
    next.delete("ate");
    next.set("periodo", preset);
    setSearchParams(next, { replace: true });
  };

  const handleCustomPeriodChange = ({ de, ate }: { de?: string; ate?: string }) => {
    const next = new URLSearchParams(searchParams);
    next.delete("periodo");
    if (de) next.set("de", de);
    else next.delete("de");
    if (ate) next.set("ate", ate);
    else next.delete("ate");
    setSearchParams(next, { replace: true });
  };

  const setAdvancedFilter = (key: keyof OrderFilters, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "marca") next.delete("modelo");
    setSearchParams(next, { replace: true });
  };

  const clearAdvancedFilters = () => {
    const next = new URLSearchParams(searchParams);
    ["cliente_id", "funcionario_id", "marca", "modelo", "prioridade", "garantia", "aprovacao"].forEach((key) => next.delete(key));
    setClienteSearch("");
    setSearchParams(next, { replace: true });
  };

  const activeFilterPills = useMemo(() => {
    const pills: { key: keyof OrderFilters; label: string }[] = [];
    const tecnico = funcionariosFiltro.find((f) => f.id === filters.funcionario_id)?.nome;
    const garantia = GARANTIA_OPTIONS.find((g) => g.value === filters.garantia)?.label;
    if (filters.cliente_id) pills.push({ key: "cliente_id", label: `Cliente: ${clienteSearch || filters.cliente_id.slice(0, 8)}` });
    if (filters.funcionario_id) pills.push({ key: "funcionario_id", label: `Técnico: ${tecnico ?? filters.funcionario_id.slice(0, 8)}` });
    if (filters.marca) pills.push({ key: "marca", label: `Marca: ${filters.marca}` });
    if (filters.modelo) pills.push({ key: "modelo", label: `Modelo: ${filters.modelo}` });
    if (filters.prioridade) pills.push({ key: "prioridade", label: `Prioridade: ${filters.prioridade}` });
    if (filters.garantia) pills.push({ key: "garantia", label: `Garantia: ${garantia ?? filters.garantia}` });
    if (filters.aprovacao) pills.push({ key: "aprovacao", label: `Aprovação: ${filters.aprovacao}` });
    return pills;
  }, [filters, funcionariosFiltro, clienteSearch]);

  // Texto e flags para o modal de confirmação
  const tecnicosComAtual = useMemo(
    () => bulk.selectedItems.filter((o: any) => !!o.funcionario_id).length,
    [bulk.selectedItems],
  );

  let confirmTitle = "";
  let confirmDescription = "";
  let confirmLabel = "";
  let confirmWarning: string | undefined;
  if (pendingBulk?.kind === "status") {
    confirmTitle = `Marcar ${affectedItems.length} OS como ${statusLabels[pendingBulk.status]}`;
    confirmDescription =
      "Esta ação atualizará o status das ordens selecionadas. As mudanças serão registradas no histórico de cada OS.";
    confirmLabel = `Marcar como ${statusLabels[pendingBulk.status]}`;
  } else if (pendingBulk?.kind === "tecnico") {
    confirmTitle = `Atribuir ${pendingBulk.nome} a ${affectedItems.length} OS`;
    confirmDescription =
      "Esta ação substituirá o técnico atual das ordens selecionadas. O histórico de transferências NÃO será criado para mudanças em massa (use a transferência individual no portal do técnico para isso).";
    confirmLabel = "Atribuir técnico";
    if (tecnicosComAtual > 0) {
      confirmWarning = `${tecnicosComAtual} OS já possuem técnico atribuído e serão substituídas.`;
    }
  }

  const grupos = useMemo(() => {
    if (!agrupar) return null;
    const map = new Map<string, typeof paginatedSorted>();
    for (const o of paginatedSorted) {
      const g = grupoData(o.data_entrada);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return map;
  }, [paginatedSorted, agrupar]);

  const activeOrders = enriched.filter((o) => o.status !== "entregue");
  const countCritica = activeOrders.filter((o) => o.prioridade.nivel === "critica").length;
  const countAtencao = activeOrders.filter((o) => o.prioridade.nivel === "atencao").length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "data_entrada" ? "desc" : "asc"); }
  }

  function SortHeader({ label, k, className = "" }: { label: string; k: SortKey; className?: string }) {
    const isActive = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`inline-flex w-full items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground ${className}`}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
        )}
      </button>
    );
  }

  function StatusDot({ status }: { status: Status }) {
    const colorMap: Partial<Record<Status, string>> = {
      recebido: "bg-info",
      em_analise: "bg-info",
      aguardando_aprovacao: "bg-warning",
      aprovado: "bg-success",
      em_reparo: "bg-warning",
      aguardando_peca: "bg-warning",
      pronto: "bg-success",
      entregue: "bg-secondary-foreground/50",
      cancelado: "bg-muted-foreground",
    };
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${colorMap[status] ?? "bg-muted-foreground"}`} />
        {statusLabels[status] ?? status}
      </span>
    );
  }

  // ── RENDER DE LINHA ───────────────────────────────────────────────────────

  function OrderRow({ order }: { order: typeof sorted[number] }) {
    const nextStatus = getNextStatus(order.status as Status);
    const phone = order.aparelhos?.clientes?.telefone;
    const isCritica = order.prioridade.nivel === "critica";
    const isCancelada = order.status === "cancelado";
    const valor = Number(order.valor ?? 0);
    const custo = Number(order.custo_pecas ?? 0);
    const lucro = valor - custo;
    const temGarantia = garantiaOrdemIds.has(order.id);
    const podeCancelar = isAdmin && ["recebido", "em_analise", "aguardando_aprovacao"].includes(order.status);

    const isSelected = isAdmin && bulk.isSelected(order.id);
    return (
      <tr className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isCritica ? "bg-destructive/5" : ""} ${isCancelada ? "opacity-60" : ""} ${isSelected ? "bg-primary/5" : ""}`}>
        {isAdmin && (
          <td className="px-3 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
            <RowCheckbox
              checked={bulk.isSelected(order.id)}
              onToggle={(opts) => bulk.toggle(order.id, opts)}
            />
          </td>
        )}
        <td className="px-3 py-2.5 font-mono text-xs text-primary cursor-pointer hover:underline"
          onClick={() => setSelectedOrderId(order.id)}
        >
          #{String(order.numero).padStart(3, "0")}
          {isCancelada && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-[9px] font-semibold">
              <XCircle className="h-2.5 w-2.5" /> Cancelada
            </span>
          )}
        </td>

        <td className="px-3 py-2.5 cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
          <p className="text-sm font-medium truncate max-w-[180px]">{order.aparelhos?.clientes?.nome ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{order.aparelhos?.marca} {order.aparelhos?.modelo}</p>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            <PrazoTag previsao={order.previsao_entrega} status={order.status} />
            <PecasPendentesTag temPeca={order.temPecaPendente} />
            {temGarantia && order.status === "entregue" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
                <Shield className="h-3 w-3" /> Em garantia
              </span>
            )}
            {order.retrabalho && (
              <span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium">
                <RefreshCw className="h-3 w-3" /> Retrabalho
              </span>
            )}
          </div>
        </td>

        <td className="px-3 py-2.5">
          <PrioridadeBadge nivel={order.prioridade.nivel} motivo={order.prioridade.motivo} />
        </td>

        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate cursor-pointer"
          onClick={() => setSelectedOrderId(order.id)}
        >
          {order.defeito_relatado}
        </td>

        <td className="px-3 py-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <StatusBadge status={order.status} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {statusFlow.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => {
                    if (s === "entregue") {
                      pedirConfirmacao({
                        orderId: order.id,
                        numero: order.numero,
                        clienteNome: order.aparelhos?.clientes?.nome ?? "—",
                      });
                    } else {
                      updateStatusMutation.mutate({ id: order.id, status: s });
                    }
                  }}
                  className="text-xs"
                >
                  {statusLabels[s]}
                  {s === order.status && <span className="ml-auto text-[10px] text-muted-foreground">atual</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>

        <td className="px-3 py-2.5 text-xs text-muted-foreground">
          {formatDate(order.data_entrada)}
        </td>

        <td className="px-3 py-2.5 text-xs text-right">
          {valor ? (
            <span className={lucro >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
              {formatCurrency(lucro)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => handleWhatsApp(phone, order.numero)}
                >
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar WhatsApp</TooltipContent>
            </Tooltip>

            {!["pronto", "entregue"].includes(order.status) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: "pronto" })}
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como Pronto</TooltipContent>
              </Tooltip>
            )}

            {order.status === "pronto" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() =>
                      pedirConfirmacao({
                        orderId: order.id,
                        numero: order.numero,
                        clienteNome: order.aparelhos?.clientes?.nome ?? "—",
                      })
                    }
                  >
                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como Entregue</TooltipContent>
              </Tooltip>
            )}

            {nextStatus && order.status !== "pronto" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: nextStatus })}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Avançar para {statusLabels[nextStatus]}</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => printEtiquetaOS({
                    numero: order.numero,
                    clienteNome: order.aparelhos?.clientes?.nome ?? "—",
                    clienteTelefone: order.aparelhos?.clientes?.telefone ?? "",
                    marca: order.aparelhos?.marca ?? "",
                    modelo: order.aparelhos?.modelo ?? "",
                    capacidade: (order.aparelhos as any)?.capacidade ?? null,
                    defeitos: order.defeito_relatado ?? "",
                    dataEntrada: order.data_entrada,
                    previsaoEntrega: order.previsao_entrega,
                    valor: order.valor,
                    imei: (order.aparelhos as any)?.imei ?? null,
                    tecnicoAtribuido: order.tecnico ?? null,
                  })}
                >
                  <Printer className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Imprimir Etiqueta</TooltipContent>
            </Tooltip>

            {podeCancelar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setCancelOrderId(order.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancelar OS</TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ── TABELA ────────────────────────────────────────────────────────────────

  function Tabela({ items }: { items: typeof sorted }) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-2 w-8">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <HeaderCheckbox
                            allSelected={bulk.allSelected}
                            someSelected={bulk.someSelected}
                            onToggle={bulk.toggleAll}
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Selecionar página</TooltipContent>
                    </Tooltip>
                  </th>
                )}
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">OS</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Cliente / Aparelho</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Prioridade</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Defeito</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Entrada</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right">Lucro</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <Wrench className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço encontrada</p>
                      <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Nova Ordem
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {totalOrders} ordens{filterStatus !== "todos" ? ` — ${allStatuses.find(s => s.value === filterStatus)?.label}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar</TooltipContent>
          </Tooltip>

          <Button variant="outline" size="sm" asChild>
            <Link to="/assistencia/fila-ia"><Brain className="h-4 w-4 mr-1" /> Fila IA</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/assistencia/fluxo"><LayoutGrid className="h-4 w-4 mr-1" /> Kanban</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                {isExporting ? "Exportando..." : "Exportar"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")} disabled={isExporting}>
                Exportar Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {can("assistencia", "criar") && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Ordem
            </Button>
          )}
        </div>
      </div>

      <NovaOrdemDialog open={dialogOpen} onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordens"] })}
      />

      <Tabs defaultValue="ordens" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ordens">Ordens de Serviço</TabsTrigger>
          <TabsTrigger value="garantias" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Garantias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ordens" className="space-y-4">
          <div className="space-y-2">
            <FiltroPeriodo
              period={period}
              onPresetChange={handlePeriodPresetChange}
              onCustomChange={handleCustomPeriodChange}
            />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, telefone, aparelho ou nº OS..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <StatusChips counts={statusCounts} active={filterStatus} onChange={(value) => setFilterStatus(value as StatusFilter)} />

            <div className="flex items-center gap-2 flex-wrap">
              <FiltrosAvancados
                filters={filters}
                clienteSearch={clienteSearch}
                setClienteSearch={setClienteSearch}
                clientes={clientesFiltro}
                funcionarios={funcionariosFiltro}
                marcas={marcasFiltro}
                modelos={modelosFiltro}
                onSetFilter={setAdvancedFilter}
                onClearAll={clearAdvancedFilters}
              />
              {activeFilterPills.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setAdvancedFilter(pill.key, undefined)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/80"
                >
                  {pill.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {activeFilterPills.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAdvancedFilters}>
                  Limpar todos os filtros
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <SortAsc className="h-3.5 w-3.5" /> Ordenar:
              </span>
              <SortBtn label="Prioridade" k="prioridade" />
              <SortBtn label="Data entrada" k="data_entrada" />
              <SortBtn label="Previsão" k="previsao_entrega" />
              <SortBtn label="Valor" k="valor" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAgrupar((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
                  agrupar
                    ? "bg-primary/10 text-primary border-primary/30 font-medium"
                    : "text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <Filter className="h-3 w-3" />
                Agrupar por data
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agrupar && grupos ? (
            <div className="space-y-6">
              {Array.from(grupos.entries()).map(([grupo, items]) => (
                <div key={grupo}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{grupo} ({items.length})</h3>
                  </div>
                  <Tabela items={items} />
                </div>
              ))}
            </div>
          ) : (
            <Tabela items={paginatedSorted} />
          )}

          {!isLoading && totalOrders > LIST_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages} — exibindo {firstVisible}-{lastVisible} de {totalOrders} ordens
              </p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="garantias">
          <GarantiasTab />
        </TabsContent>
      </Tabs>

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      <ConfirmarEntregaDialog
        entrega={entrega}
        onConfirm={(id) => {
          updateStatusMutation.mutate({ id, status: "entregue" });
          cancelar();
        }}
        onCancel={cancelar}
      />
      <CancelarOSDialog
        ordemId={cancelOrderId}
        onClose={() => setCancelOrderId(null)}
      />

      {isAdmin && (
        <>
          <BulkActionBar
            count={bulk.count}
            tecnicos={tecnicos}
            onChangeStatus={(status) => setPendingBulk({ kind: "status", status })}
            onAtribuirTecnico={(funcionarioId, nome) =>
              setPendingBulk({ kind: "tecnico", funcionarioId, nome })
            }
            onExportCSV={() => handleExport("csv")}
            onClear={bulk.clear}
          />
          <BulkActionConfirmDialog
            open={!!pendingBulk}
            onClose={() => setPendingBulk(null)}
            onConfirm={handleConfirmBulk}
            title={confirmTitle}
            description={confirmDescription}
            affected={affectedItems}
            warningMessage={confirmWarning}
            confirmLabel={confirmLabel}
          />
        </>
      )}
    </div>
  );
}
