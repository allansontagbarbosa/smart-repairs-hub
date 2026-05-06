import { useState, useMemo, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  subQuarters,
  subYears,
  format,
  differenceInDays,
  differenceInMilliseconds,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDesempenhoTecnicos, type KpiTecnico } from "@/hooks/useDesempenhoTecnicos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Trophy,
  Wrench,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Loader2,
  Receipt,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  RefreshCw,
  CalendarClock,
  X,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DrillDownTecnicoSheet } from "@/components/relatorios/DrillDownTecnicoSheet";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtHoras = (h: number) => {
  if (!h || h === 0) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

type PresetId =
  | "hoje"
  | "ontem"
  | "esta_semana"
  | "ultimos_7"
  | "ultimos_30"
  | "este_mes"
  | "mes_passado"
  | "este_trimestre"
  | "este_ano"
  | "personalizado";

const N = () => new Date();
const D = (d: Date) => ({ inicio: startOfDay(d), fim: endOfDay(d) });
const M = (d: Date) => ({ inicio: startOfMonth(d), fim: endOfMonth(d) });

const PRESETS: { id: PresetId; label: string; range: () => { inicio: Date; fim: Date } | null }[] = [
  { id: "hoje", label: "Hoje", range: () => D(N()) },
  { id: "ontem", label: "Ontem", range: () => D(subDays(N(), 1)) },
  { id: "esta_semana", label: "Esta semana", range: () => ({ inicio: startOfWeek(N(), { locale: ptBR }), fim: endOfWeek(N(), { locale: ptBR }) }) },
  { id: "ultimos_7", label: "Últimos 7 dias", range: () => ({ inicio: startOfDay(subDays(N(), 6)), fim: endOfDay(N()) }) },
  { id: "ultimos_30", label: "Últimos 30 dias", range: () => ({ inicio: startOfDay(subDays(N(), 29)), fim: endOfDay(N()) }) },
  { id: "este_mes", label: "Este mês", range: () => M(N()) },
  { id: "mes_passado", label: "Mês passado", range: () => M(subMonths(N(), 1)) },
  { id: "este_trimestre", label: "Este trimestre", range: () => ({ inicio: startOfQuarter(N()), fim: endOfQuarter(N()) }) },
  { id: "este_ano", label: "Este ano", range: () => ({ inicio: startOfYear(N()), fim: endOfYear(N()) }) },
  { id: "personalizado", label: "Personalizado", range: () => null },
];

type SortKey =
  | "nome"
  | "qtd_servicos"
  | "qtd_os"
  | "faturamento_os"
  | "ticket_medio_os"
  | "tempo_medio_horas"
  | "comissao_pendente"
  | "comissao_liberada"
  | "comissao_paga"
  | "comissao_total_a_receber";

export default function DesempenhoTecnicos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [preset, setPreset] = useState<PresetId>(
    (searchParams.get("preset") as PresetId) || "este_mes",
  );
  const [customRange, setCustomRange] = useState<{ inicio: Date | null; fim: Date | null }>({
    inicio: searchParams.get("de") ? new Date(searchParams.get("de") + "T00:00:00") : null,
    fim: searchParams.get("ate") ? new Date(searchParams.get("ate") + "T00:00:00") : null,
  });
  const [lojaId, setLojaId] = useState<string | null>(searchParams.get("loja"));
  const [selecionados, setSelecionados] = useState<Set<string>>(
    new Set((searchParams.get("tecs") || "").split(",").filter(Boolean)),
  );
  const [busca, setBusca] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("preset", preset);
    if (preset === "personalizado" && customRange.inicio && customRange.fim) {
      sp.set("de", format(customRange.inicio, "yyyy-MM-dd"));
      sp.set("ate", format(customRange.fim, "yyyy-MM-dd"));
    }
    if (lojaId) sp.set("loja", lojaId);
    if (selecionados.size > 0) sp.set("tecs", [...selecionados].join(","));
    if (busca) sp.set("q", busca);
    setSearchParams(sp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customRange.inicio, customRange.fim, lojaId, selecionados, busca]);

  const range = useMemo(() => {
    if (preset === "personalizado") {
      return customRange.inicio && customRange.fim
        ? { inicio: startOfDay(customRange.inicio), fim: endOfDay(customRange.fim) }
        : { inicio: startOfMonth(N()), fim: endOfMonth(N()) };
    }
    return PRESETS.find((p) => p.id === preset)!.range()!;
  }, [preset, customRange]);

  const rangeAnterior = useMemo(() => {
    const hoje = endOfDay(N());
    const fimEf = range.fim > hoje ? hoje : range.fim;
    if (preset === "este_mes")
      return { inicio: startOfMonth(subMonths(N(), 1)), fim: subMonths(fimEf, 1) };
    if (preset === "este_trimestre")
      return { inicio: startOfQuarter(subQuarters(N(), 1)), fim: subQuarters(fimEf, 1) };
    if (preset === "este_ano")
      return { inicio: startOfYear(subYears(N(), 1)), fim: subYears(fimEf, 1) };
    const dias = Math.max(1, differenceInDays(range.fim, range.inicio) + 1);
    return { inicio: subDays(range.inicio, dias), fim: subDays(range.fim, dias) };
  }, [range, preset]);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-ativas-desempenho"],
    queryFn: async () =>
      (await supabase.from("lojas").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
    staleTime: 300_000,
  });

  const {
    data: tecnicos = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useDesempenhoTecnicos(range.inicio, range.fim, lojaId);
  const { data: tecnicosAnterior = [] } = useDesempenhoTecnicos(
    rangeAnterior.inicio,
    rangeAnterior.fim,
    lojaId,
  );

  const [sortKey, setSortKey] = useState<SortKey>("comissao_total_a_receber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drilldownTec, setDrilldownTec] = useState<{ id: string; nome: string } | null>(null);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };


  const tecnicosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let lista = tecnicos;
    if (selecionados.size > 0) lista = lista.filter((t) => selecionados.has(t.funcionario_id));
    if (q) lista = lista.filter((t) => (t.nome ?? "").toLowerCase().includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    lista = [...lista].sort((a, b) => {
      const va = sortKey === "nome" ? (a.nome ?? "").toLowerCase() : Number((a as any)[sortKey] ?? 0);
      const vb = sortKey === "nome" ? (b.nome ?? "").toLowerCase() : Number((b as any)[sortKey] ?? 0);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return lista;
  }, [tecnicos, busca, sortKey, sortDir, selecionados]);

  const totais = useMemo(
    () => ({
      qtd_servicos: tecnicosFiltrados.reduce((s, t) => s + Number(t.qtd_servicos), 0),
      qtd_os: tecnicosFiltrados.reduce((s, t) => s + Number(t.qtd_os), 0),
      faturamento: tecnicosFiltrados.reduce((s, t) => s + Number(t.faturamento_os), 0),
      a_receber: tecnicosFiltrados.reduce(
        (s, t) => s + Number(t.comissao_total_a_receber),
        0,
      ),
      paga: tecnicosFiltrados.reduce((s, t) => s + Number(t.comissao_paga), 0),
      pendente: tecnicosFiltrados.reduce((s, t) => s + Number(t.comissao_pendente), 0),
      liberada: tecnicosFiltrados.reduce((s, t) => s + Number(t.comissao_liberada), 0),
    }),
    [tecnicosFiltrados],
  );

  const totaisAnterior = useMemo(() => {
    const filtrados = selecionados.size > 0
      ? tecnicosAnterior.filter((t) => selecionados.has(t.funcionario_id))
      : tecnicosAnterior;
    return {
      qtd_servicos: filtrados.reduce((s, t) => s + Number(t.qtd_servicos), 0),
      faturamento: filtrados.reduce((s, t) => s + Number(t.faturamento_os), 0),
      a_receber: filtrados.reduce((s, t) => s + Number(t.comissao_total_a_receber), 0),
      paga: filtrados.reduce((s, t) => s + Number(t.comissao_paga), 0),
    };
  }, [tecnicosAnterior, selecionados]);

  const tecnicoAnteriorPorId = useMemo(() => {
    const m = new Map<string, KpiTecnico>();
    for (const t of tecnicosAnterior) m.set(t.funcionario_id, t);
    return m;
  }, [tecnicosAnterior]);

  const maxServicos = useMemo(() => {
    return tecnicosFiltrados.reduce(
      (max, t) => Math.max(max, Number(t.qtd_servicos) || 0),
      0,
    );
  }, [tecnicosFiltrados]);

  function variacao(atual: number, anterior: number): { pct: number; cor: string } {
    if (anterior === 0)
      return {
        pct: atual > 0 ? 100 : 0,
        cor: atual > 0 ? "text-emerald-600" : "text-muted-foreground",
      };
    const pct = ((atual - anterior) / anterior) * 100;
    return {
      pct,
      cor: pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-600" : "text-muted-foreground",
    };
  }

  

  const dadosGrafico = useMemo(() => {
    return tecnicosFiltrados
      .slice(0, 10)
      .map((t) => ({
        nome: (t.nome ?? "—").split(" ").slice(0, 2).join(" "),
        servicos: Number(t.qtd_servicos),
        funcionario_id: t.funcionario_id,
      }))
      .filter((t) => t.servicos > 0);
  }, [tecnicosFiltrados]);

  const exportarCSV = () => {
    const header = [
      "Técnico",
      "Serviços",
      "OS",
      "Faturamento (R$)",
      "Ticket médio (R$)",
      "Tempo médio (h)",
      "Pendente (R$)",
      "Liberada (R$)",
      "Paga (R$)",
      "A receber (R$)",
    ];
    const rows = tecnicosFiltrados.map((t) =>
      [
        `"${(t.nome ?? "").replace(/"/g, '""')}"`,
        t.qtd_servicos,
        t.qtd_os,
        Number(t.faturamento_os).toFixed(2).replace(".", ","),
        Number(t.ticket_medio_os).toFixed(2).replace(".", ","),
        Number(t.tempo_medio_horas ?? 0).toFixed(1).replace(".", ","),
        Number(t.comissao_pendente).toFixed(2).replace(".", ","),
        Number(t.comissao_liberada).toFixed(2).replace(".", ","),
        Number(t.comissao_paga).toFixed(2).replace(".", ","),
        Number(t.comissao_total_a_receber).toFixed(2).replace(".", ","),
      ].join(";"),
    );
    const csv = "\uFEFF" + [header.join(";"), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desempenho-tecnicos-${format(range.inicio, "yyyy-MM-dd")}-${format(
      range.fim,
      "yyyy-MM-dd",
    )}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const varServicos = variacao(totais.qtd_servicos, totaisAnterior.qtd_servicos);
  const varFaturamento = variacao(totais.faturamento, totaisAnterior.faturamento);
  const varAReceber = variacao(totais.a_receber, totaisAnterior.a_receber);
  const varPaga = variacao(totais.paga, totaisAnterior.paga);

  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const minDesdeUpdate = dataUpdatedAt
    ? Math.floor(differenceInMilliseconds(agora, dataUpdatedAt) / 60_000)
    : null;

  const limparFiltros = () => {
    setPreset("este_mes");
    setCustomRange({ inicio: null, fim: null });
    setLojaId(null);
    setSelecionados(new Set());
    setBusca("");
  };
  const algumFiltroAtivo =
    preset !== "este_mes" || lojaId !== null || selecionados.size > 0 || !!busca;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="page-title">Desempenho dos técnicos</h1>
          <p className="page-subtitle">
            {format(range.inicio, "dd/MM/yyyy", { locale: ptBR })} –{" "}
            {format(range.fim, "dd/MM/yyyy", { locale: ptBR })} · vs{" "}
            {format(rangeAnterior.inicio, "dd/MM", { locale: ptBR })}–
            {format(rangeAnterior.fim, "dd/MM", { locale: ptBR })}
            {minDesdeUpdate !== null && minDesdeUpdate >= 1 && (
              <span className="ml-2 text-xs text-muted-foreground/70">
                · atualizado há {minDesdeUpdate} min
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={exportarCSV}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <CardKpiVar
          icon={Wrench}
          label="Serviços"
          value={String(totais.qtd_servicos)}
          variacao={varServicos}
        />
        <CardKpi icon={Receipt} label="OS atendidas" value={String(totais.qtd_os)} />
        <CardKpiVar
          icon={DollarSign}
          label="Faturamento"
          value={brl(totais.faturamento)}
          variacao={varFaturamento}
        />
        <CardKpiVar
          icon={TrendingUp}
          label="Comissão a receber"
          value={brl(totais.a_receber)}
          variacao={varAReceber}
        />
        <CardKpiVar
          icon={DollarSign}
          label="Comissão paga"
          value={brl(totais.paga)}
          variacao={varPaga}
          accent={totais.paga > 0}
        />
      </div>

      {tecnicosFiltrados.length > 0 && tecnicosFiltrados.some(t => t.comissao_total_a_receber > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pódio do período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 items-end">
              <PodiumSlot rank={2} tecnico={tecnicosFiltrados[1]} />
              <PodiumSlot rank={1} tecnico={tecnicosFiltrados[0]} />
              <PodiumSlot rank={3} tecnico={tecnicosFiltrados[2]} />
            </div>
          </CardContent>
        </Card>
      )}

      {dadosGrafico.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Serviços concluídos por técnico (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: "100%", height: Math.max(220, dadosGrafico.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosGrafico}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={{ fontSize: 12 }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} serviços`, ""]}
                    cursor={{ fill: "rgba(0,200,150,0.08)" }}
                  />
                  <Bar dataKey="servicos" radius={[0, 6, 6, 0]}>
                    {dadosGrafico.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">Detalhe por técnico</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar técnico..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <Th k="nome" label="Técnico" align="left" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="qtd_servicos" label="Serviços" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground/70">vs ant.</th>
                  <Th k="qtd_os" label="OS" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="faturamento_os" label="Faturamento" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground/70">vs ant.</th>
                  <Th k="ticket_medio_os" label="Ticket médio" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="tempo_medio_horas" label="Tempo médio" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="comissao_pendente" label="Pendente" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="comissao_liberada" label="Liberada" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="comissao_paga" label="Paga" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th k="comissao_total_a_receber" label="A receber" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && tecnicosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-muted-foreground">
                      {busca ? "Nenhum técnico encontrado para a busca." : "Nenhum dado no período."}
                    </td>
                  </tr>
                )}
                {tecnicosFiltrados.map((t: KpiTecnico, i) => (
                  <tr
                    key={t.funcionario_id}
                    onClick={() => setDrilldownTec({ id: t.funcionario_id, nome: t.nome })}
                    className="border-t border-border cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {i === 0 && t.comissao_total_a_receber > 0 && (
                          <Trophy className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="font-medium">{t.nome}</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums relative">
                      <div
                        aria-hidden="true"
                        className="absolute inset-y-1 left-0 rounded-sm bg-primary/15 pointer-events-none"
                        style={{
                          width:
                            maxServicos > 0
                              ? `${Math.max(2, (Number(t.qtd_servicos) / maxServicos) * 100)}%`
                              : "0%",
                        }}
                      />
                      <span className="relative">{t.qtd_servicos}</span>
                    </td>
                    <td className="text-right">
                      <TrendPill
                        atual={Number(t.qtd_servicos)}
                        anterior={Number(tecnicoAnteriorPorId.get(t.funcionario_id)?.qtd_servicos ?? 0)}
                      />
                    </td>
                    <td className="text-right tabular-nums">{t.qtd_os}</td>
                    <td className="text-right tabular-nums">{brl(Number(t.faturamento_os))}</td>
                    <td className="text-right">
                      <TrendPill
                        atual={Number(t.faturamento_os)}
                        anterior={Number(tecnicoAnteriorPorId.get(t.funcionario_id)?.faturamento_os ?? 0)}
                      />
                    </td>
                    <td className="text-right tabular-nums">{brl(Number(t.ticket_medio_os))}</td>
                    <td className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {fmtHoras(Number(t.tempo_medio_horas))}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-amber-600">
                      {brl(Number(t.comissao_pendente))}
                    </td>
                    <td className="text-right tabular-nums text-blue-600">
                      {brl(Number(t.comissao_liberada))}
                    </td>
                    <td className="text-right tabular-nums text-emerald-600">
                      {brl(Number(t.comissao_paga))}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {brl(Number(t.comissao_total_a_receber))}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!isLoading && tecnicosFiltrados.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td className="py-2">TOTAL ({tecnicosFiltrados.length})</td>
                    <td className="text-right tabular-nums">{totais.qtd_servicos}</td>
                    <td className="text-right text-muted-foreground">—</td>
                    <td className="text-right tabular-nums">{totais.qtd_os}</td>
                    <td className="text-right tabular-nums">{brl(totais.faturamento)}</td>
                    <td className="text-right text-muted-foreground">—</td>
                    <td className="text-right text-muted-foreground">—</td>
                    <td className="text-right text-muted-foreground">—</td>
                    <td className="text-right tabular-nums text-amber-700">{brl(totais.pendente)}</td>
                    <td className="text-right tabular-nums text-blue-700">{brl(totais.liberada)}</td>
                    <td className="text-right tabular-nums text-emerald-700">{brl(totais.paga)}</td>
                    <td className="text-right tabular-nums">{brl(totais.a_receber)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Clique no nome do técnico para ver as comissões detalhadas.
          </p>
        </CardContent>
      </Card>

      <DrillDownTecnicoSheet
        open={!!drilldownTec}
        onOpenChange={(v) => !v && setDrilldownTec(null)}
        funcionarioId={drilldownTec?.id ?? null}
        funcionarioNome={drilldownTec?.nome ?? ""}
        inicio={range.inicio}
        fim={range.fim}
      />
    </div>
  );
}

function CardKpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card ${accent ? "border-success/20 bg-success-muted" : ""}`}>
      <Icon className={`h-4 w-4 mb-2 ${accent ? "text-success" : "text-muted-foreground"}`} />
      <p className="stat-label">{label}</p>
      <p className={`stat-value text-lg ${accent ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

function CardKpiVar({
  icon: Icon,
  label,
  value,
  variacao,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  variacao: { pct: number; cor: string };
  accent?: boolean;
}) {
  const Arrow = variacao.pct > 0 ? TrendingUp : variacao.pct < 0 ? TrendingDown : null;
  return (
    <div className={`stat-card ${accent ? "border-success/20 bg-success-muted" : ""}`}>
      <Icon className={`h-4 w-4 mb-2 ${accent ? "text-success" : "text-muted-foreground"}`} />
      <p className="stat-label">{label}</p>
      <p className={`stat-value text-lg ${accent ? "text-success" : ""}`}>{value}</p>
      {variacao.pct !== 0 && (
        <p className={`text-[11px] mt-1 inline-flex items-center gap-1 ${variacao.cor}`}>
          {Arrow && <Arrow className="h-3 w-3" />}
          {variacao.pct > 0 ? "+" : ""}
          {variacao.pct.toFixed(0)}% vs anterior
        </p>
      )}
    </div>
  );
}

function Th({
  k,
  label,
  sortKey,
  sortDir,
  onSort,
  align,
}: {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = sortKey === k;
  const isLeft = align === "left";
  return (
    <th className={`py-2 ${isLeft ? "text-left" : "text-right"}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          isActive ? "text-foreground" : ""
        }`}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function PodiumSlot({
  rank,
  tecnico,
}: {
  rank: 1 | 2 | 3;
  tecnico?: KpiTecnico;
}) {
  if (!tecnico) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center">
        <p className="text-xs text-muted-foreground">{rank}º lugar</p>
        <p className="text-sm text-muted-foreground mt-1">—</p>
      </div>
    );
  }

  const isLider = rank === 1;
  const medalBg =
    rank === 1
      ? "bg-primary text-primary-foreground"
      : rank === 2
      ? "bg-muted-foreground/70 text-background"
      : "bg-orange-500/80 text-white";

  return (
    <div
      className={[
        "rounded-lg border bg-card flex flex-col items-center px-3 py-4 relative",
        isLider
          ? "border-2 border-primary bg-primary/5 -translate-y-2 shadow-sm"
          : "border-border",
      ].join(" ")}
    >
      {isLider && (
        <span className="absolute -top-2.5 right-2 bg-primary text-primary-foreground text-[10px] font-medium px-2 py-0.5 rounded-full tracking-wider">
          LÍDER
        </span>
      )}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-base mb-2 ${medalBg}`}
      >
        {isLider ? <Trophy className="h-4 w-4" /> : `${rank}º`}
      </div>
      <p className={`font-medium ${isLider ? "text-base" : "text-sm"}`}>
        {tecnico.nome}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {tecnico.qtd_os} OS · {tecnico.qtd_servicos} serviços
      </p>
      <p
        className={`font-medium mt-2 leading-none ${
          isLider ? "text-2xl text-primary" : "text-xl"
        }`}
      >
        {brl(Number(tecnico.comissao_total_a_receber))}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">a receber</p>
    </div>
  );
}

function TrendPill({
  atual,
  anterior,
}: {
  atual: number;
  anterior: number;
}) {
  if (anterior === 0 && atual === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  if (anterior === 0 && atual > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
        <TrendingUp className="h-3 w-3" />
        novo
      </span>
    );
  }
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 1) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const isUp = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
        isUp
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isUp ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}
