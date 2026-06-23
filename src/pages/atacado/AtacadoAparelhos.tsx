import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  Smartphone,
  Plus,
  Search,
  Package,
  AlertCircle,
  Loader2,
  Download,
  LayoutGrid,
  Rows,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/utils";
import { exportToCsv } from "@/lib/export-csv";
import { NovaEntradaAtacadoDialog } from "@/components/atacado/NovaEntradaAtacadoDialog";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";
import {
  AtacadoStatusBadge,
  getStatusCategoria,
} from "@/components/atacado/AtacadoStatusBadge";
import { AtacadoAparelhoDetalheSheet } from "@/components/atacado/AtacadoAparelhoDetalheSheet";
import { AtacadoAparelhoAcoesMenu } from "@/components/atacado/AtacadoAparelhoAcoesMenu";
import { computeInventarioKpis } from "@/lib/atacadoInventarioKpis";

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

type ViewMode = "unidade" | "modelo";

export default function AtacadoAparelhos() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounced(busca, 300);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("unidade");
  const [grupoSort, setGrupoSort] = useState<"valor" | "qtd">("valor");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const { data: empresa } = useQuery({
    queryKey: ["empresa-config-atacado", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas" as any)
        .select("id, estoque_compartilhado_loja_atacado, modulo_loja_ativo")
        .eq("id", empresaId!)
        .single();
      return data as any;
    },
    enabled: !!empresaId,
  });

  const compartilhado = empresa?.estoque_compartilhado_loja_atacado ?? false;
  const lojaAtiva = empresa?.modulo_loja_ativo ?? false;

  const toggleCompartilhado = useMutation({
    mutationFn: async (novo: boolean) => {
      const { error } = await supabase
        .from("empresas" as any)
        .update({ estoque_compartilhado_loja_atacado: novo })
        .eq("id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-config-atacado"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      toast({ title: "✓ Configuração atualizada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const { data: statusCatalogo = [] } = useQuery({
    queryKey: ["atacado-status-catalogo", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_status_aparelho" as any)
        .select("nome, categoria")
        .eq("empresa_id", empresaId!);
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: aparelhosRaw = [], isLoading, error: aparelhosError } = useQuery({
    queryKey: ["atacado-aparelhos", empresaId, buscaDebounced],
    queryFn: async () => {
      let q = supabase
        .from("atacado_aparelhos" as any)
        .select(`*, fornecedor:fornecedores(nome)`)
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);
      if (buscaDebounced) {
        const t = buscaDebounced.replace(/[%,()]/g, "");
        q = q.or(
          `modelo.ilike.%${t}%,imei_1.ilike.%${t}%,imei_2.ilike.%${t}%`,
        );
      }
      const { data, error } = await q.order("data_entrada", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  // Soma de assistências por aparelho (todas, escopo empresa via RLS)
  const aparelhoIds = useMemo(
    () => aparelhosRaw.map((a: any) => a.id),
    [aparelhosRaw],
  );

  const { data: assistMap = {} as Record<string, number> } = useQuery({
    queryKey: ["atacado-aparelho-assistencias-soma", empresaId, aparelhoIds],
    queryFn: async () => {
      if (aparelhoIds.length === 0) return {};
      const { data, error } = await supabase
        .from("atacado_aparelho_assistencias" as any)
        .select("aparelho_id, valor")
        .eq("empresa_id", empresaId!)
        .in("aparelho_id", aparelhoIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data as any[]).forEach((r) => {
        map[r.aparelho_id] = (map[r.aparelho_id] ?? 0) + Number(r.valor ?? 0);
      });
      return map;
    },
    enabled: !!empresaId && aparelhoIds.length > 0,
  });

  const filtroParaCategoria: Record<string, string> = {
    estoque: "em_estoque",
    reservado: "reservado",
    vendido: "vendido",
    em_transito: "em_transito",
  };

  const aparelhos =
    statusFilter === "todos"
      ? aparelhosRaw
      : aparelhosRaw.filter(
          (a: any) =>
            getStatusCategoria(a.status, statusCatalogo) ===
            filtroParaCategoria[statusFilter],
        );

  const { data: aparelhosLoja = [] } = useQuery({
    queryKey: ["loja-aparelhos-via-atacado", empresaId, buscaDebounced],
    queryFn: async () => {
      let q = supabase
        .from("loja_aparelhos" as any)
        .select("id, modelo, capacidade, cor, imei_1, custo, preco_venda, status")
        .eq("empresa_id", empresaId!)
        .eq("status", "estoque")
        .is("deleted_at", null);
      if (buscaDebounced) {
        const t = buscaDebounced.replace(/[%,()]/g, "");
        q = q.or(`modelo.ilike.%${t}%,imei_1.ilike.%${t}%`);
      }
      const { data } = await q.order("created_at", { ascending: false }).limit(50);
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId && compartilhado && lojaAtiva,
  });

  const totalLotes = aparelhos.length;
  const totalUnidades = aparelhos.reduce(
    (s: number, a: any) => s + (a.quantidade || 0),
    0,
  );
  const valorEstoque = aparelhos.reduce(
    (s: number, a: any) => s + a.quantidade * Number(a.custo),
    0,
  );
  // Valor de venda (somente itens em estoque)
  const aparelhosEmEstoque = aparelhos.filter(
    (a: any) => getStatusCategoria(a.status, statusCatalogo) === "em_estoque",
  );
  const valorVenda = aparelhosEmEstoque.reduce(
    (s: number, a: any) =>
      s + (Number(a.preco_sugerido ?? 0) || 0) * (a.quantidade || 0),
    0,
  );
  const custoEmEstoque = aparelhosEmEstoque.reduce(
    (s: number, a: any) => s + Number(a.custo) * (a.quantidade || 0),
    0,
  );
  const lucroPotencial = Math.max(0, valorVenda - custoEmEstoque);
  const lotesBaixoEstoque = aparelhos.filter(
    (a: any) =>
      getStatusCategoria(a.status, statusCatalogo) === "em_estoque" &&
      a.quantidade <= 2,
  ).length;

  // KPIs do inventário inteiro (todos os aparelhos não-vendidos)
  const invKpis = useMemo(
    () => computeInventarioKpis(aparelhosRaw, statusCatalogo),
    [aparelhosRaw, statusCatalogo],
  );

  // Agrupado por modelo
  const grupos = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of aparelhos) {
      const key = `${a.modelo}|${a.capacidade ?? ""}|${a.cor ?? ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    const lista = Array.from(map.entries()).map(([key, itens]) => {
      const qtd = itens.reduce((s, i) => s + (i.quantidade || 0), 0);
      const custoMedio =
        itens.reduce((s, i) => s + Number(i.custo) * i.quantidade, 0) /
        Math.max(1, qtd);
      const precoMin = itens
        .filter((i) => Number(i.preco_sugerido) > 0)
        .reduce(
          (m, i) => Math.min(m, Number(i.preco_sugerido)),
          Number.POSITIVE_INFINITY,
        );
      const emEstoque = itens.filter(
        (i) => getStatusCategoria(i.status, statusCatalogo) === "em_estoque",
      );
      const qtdEmEstoque = emEstoque.reduce(
        (s, i) => s + (i.quantidade || 0),
        0,
      );
      const valorVendavel = emEstoque.reduce(
        (s, i) =>
          s + (Number(i.preco_sugerido ?? 0) || 0) * (i.quantidade || 0),
        0,
      );
      const custoTotalGrupo = itens.reduce(
        (s, i) => s + Number(i.custo) * (i.quantidade || 0),
        0,
      );
      const ticketMedio =
        qtdEmEstoque > 0 ? valorVendavel / qtdEmEstoque : 0;
      return {
        key,
        itens,
        qtd,
        qtdEmEstoque,
        custoMedio,
        precoMin,
        valorVendavel,
        custoTotalGrupo,
        ticketMedio,
      };
    });
    lista.sort((a, b) =>
      grupoSort === "valor"
        ? b.valorVendavel - a.valorVendavel
        : b.qtdEmEstoque - a.qtdEmEstoque,
    );
    return lista;
  }, [aparelhos, statusCatalogo, grupoSort]);

  const toggleGrupo = (key: string) => {
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const handleExport = () => {
    exportToCsv(
      `estoque-atacado-${new Date().toISOString().slice(0, 10)}.csv`,
      aparelhos,
      [
        { header: "Modelo", value: (a: any) => a.modelo },
        { header: "Capacidade", value: (a: any) => a.capacidade ?? "" },
        { header: "Cor", value: (a: any) => a.cor ?? "" },
        { header: "Grade", value: (a: any) => a.grade ?? "" },
        { header: "Condição", value: (a: any) => a.condicao ?? "" },
        { header: "IMEI 1", value: (a: any) => a.imei_1 ?? "" },
        { header: "IMEI 2", value: (a: any) => a.imei_2 ?? "" },
        { header: "Fornecedor", value: (a: any) => a.fornecedor?.nome ?? "" },
        { header: "Qtd", value: (a: any) => a.quantidade ?? 0 },
        { header: "Custo total (R$)", value: (a: any) => Number(a.custo).toFixed(2) },
        {
          header: "Assistência (R$)",
          value: (a: any) => Number(assistMap[a.id] ?? 0).toFixed(2),
        },
        {
          header: "Preço sugerido (R$)",
          value: (a: any) => Number(a.preco_sugerido ?? 0).toFixed(2),
        },
        {
          header: "Lucro (R$)",
          value: (a: any) =>
            (Number(a.preco_sugerido ?? 0) - Number(a.custo)).toFixed(2),
        },
        { header: "Status", value: (a: any) => a.status ?? "" },
        {
          header: "Data entrada",
          value: (a: any) =>
            a.data_entrada
              ? new Date(a.data_entrada).toLocaleDateString("pt-BR")
              : "",
        },
      ],
    );
  };

  const renderLinha = (a: any) => {
    const custoNum = Number(a.custo);
    const precoNum = Number(a.preco_sugerido ?? 0);
    const lucro = precoNum > 0 ? precoNum - custoNum : 0;
    const markup = custoNum > 0 && precoNum > 0 ? (lucro / custoNum) * 100 : 0;
    const margem = precoNum > 0 ? (lucro / precoNum) * 100 : 0;
    const diasParado = a.data_entrada
      ? Math.floor((Date.now() - new Date(a.data_entrada).getTime()) / 86400000)
      : 0;
    const cat = getStatusCategoria(a.status, statusCatalogo);
    const baixo = cat === "em_estoque" && a.quantidade <= 2;
    const lento = cat === "em_estoque" && diasParado > 30;
    const assist = Number(assistMap[a.id] ?? 0);
    return (
      <tr
        key={a.id}
        onClick={() => setDetalheId(a.id)}
        className="border-b hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <td className="px-4 py-3">
          <p className="font-medium text-foreground">
            {a.modelo} {a.capacidade ?? ""} {a.cor ?? ""}
          </p>
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
            <span>{a.fornecedor?.nome ?? "—"}</span>
            {a.imei_1 && (
              <span className="inline-flex items-center gap-1 font-mono">
                · IMEI {a.imei_1}
                <CopyImei value={a.imei_1} />
              </span>
            )}
            {a.data_entrada && <span>· há {diasParado}d em estoque</span>}
            {assist > 0 && (
              <span className="text-warning">· +{formatBRL(assist)} assist.</span>
            )}
            {baixo && <span className="text-warning">· estoque baixo</span>}
            {lento && <span className="text-destructive">· giro lento</span>}
          </p>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge
            variant="outline"
            className={
              baixo ? "bg-warning/15 text-warning border-warning/30" : ""
            }
          >
            {a.quantidade}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {formatBRL(custoNum)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {precoNum > 0 ? formatBRL(precoNum) : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {precoNum > 0 ? (
            <div>
              <div
                className={`tabular-nums font-medium ${
                  lucro >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {formatBRL(lucro)}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {markup.toFixed(1)}% mk · {margem.toFixed(1)}% mg
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <AtacadoStatusBadge status={a.status} catalogo={statusCatalogo} />
        </td>
        <td className="px-2 py-3 text-right">
          <AtacadoAparelhoAcoesMenu
            aparelho={a}
            statusCatalogo={statusCatalogo}
            onVerDetalhes={() => setDetalheId(a.id)}
          />
        </td>
      </tr>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estoque Atacado</h1>
            <p className="text-sm text-muted-foreground">Aparelhos por lote (quantidade)</p>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setNovoOpen(true)}>
                  <Plus className="h-4 w-4" /> Entrada rápida
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Adicionar unidade avulsa a um SKU já existente
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => (window.location.href = "/atacado/aparelhos/novo")}
                >
                  <Plus className="h-4 w-4" /> Novo produto / lote
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Cadastro completo (modelo, fornecedor, custos, assistências)
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {lojaAtiva && (
          <div className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-foreground">
                Estoque compartilhado com Loja
              </p>
              <p className="text-xs text-muted-foreground">
                {compartilhado
                  ? "✓ Os aparelhos da Loja também aparecem disponíveis pra venda no Atacado. A baixa acontece de onde o item estiver."
                  : "Os estoques estão separados. Aparelhos da Loja não aparecem pra venda no Atacado."}
              </p>
            </div>
            <Switch
              checked={compartilhado}
              onCheckedChange={(v) => toggleCompartilhado.mutate(v)}
              disabled={toggleCompartilhado.isPending}
            />
          </div>
        )}

        {/* KPIs do inventário inteiro (estoque + transporte + assistência) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiBox
            label="Unidades no inventário"
            valor={String(invKpis.unidades)}
            hint={`${invKpis.totalAparelhosNaoVendidos} aparelhos não-vendidos`}
          />
          <KpiBox
            label="Custo total"
            valor={formatBRL(invKpis.custoTotal)}
          />
          <KpiBox
            label="Valor de venda total"
            valor={formatBRL(invKpis.vendaTotal)}
            hint="estoque + transporte + assistência"
          />
          <KpiBox
            label="Lucro potencial total"
            valor={formatBRL(invKpis.lucroPotencial)}
            success={invKpis.lucroPotencial > 0}
          />
          <KpiBox
            label="Lucro médio por aparelho"
            valor={formatBRL(invKpis.lucroMedioPorAparelho)}
          />
          <KpiBox
            label="Markup médio"
            valor={`${invKpis.markupMedioPct.toFixed(1)}%`}
            hint={`margem ${invKpis.margemMediaPct.toFixed(1)}%`}
          />
        </div>

        {/* Valor por local */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LocalCard
            label="Em estoque"
            color="text-success"
            local={invKpis.porLocal.em_estoque}
          />
          <LocalCard
            label="Em transporte"
            color="text-info"
            local={invKpis.porLocal.em_transito}
          />
          <LocalCard
            label="Na assistência"
            color="text-orange-600"
            local={invKpis.porLocal.em_assistencia}
          />
        </div>

        {/* KPIs auxiliares (filtro atual) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Lotes (filtro)" valor={String(totalLotes)} />
          <KpiBox label="Unidades (filtro)" valor={String(totalUnidades)} />
          <KpiBox label="Valor de venda em estoque" valor={formatBRL(valorVenda)} />
          <KpiBox
            label="Estoque baixo"
            valor={String(lotesBaixoEstoque)}
            danger={lotesBaixoEstoque > 0}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por modelo ou IMEI…"
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="estoque">Em estoque</SelectItem>
              <SelectItem value="reservado">Reservados</SelectItem>
              <SelectItem value="vendido">Vendidos</SelectItem>
              <SelectItem value="em_transito">Em trânsito</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={viewMode === "unidade" ? "secondary" : "outline"}
                  onClick={() => setViewMode("unidade")}
                >
                  <Rows className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Por unidade</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={viewMode === "modelo" ? "secondary" : "outline"}
                  onClick={() => setViewMode("modelo")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Agrupar por modelo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExport}
                  disabled={aparelhos.length === 0}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar CSV (lista filtrada)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : aparelhosError ? (
          <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-6 text-center space-y-2">
            <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
            <p className="text-sm font-medium text-destructive">Erro ao carregar aparelhos</p>
            <p className="text-xs text-muted-foreground">{(aparelhosError as any)?.message ?? "Tente novamente."}</p>
          </div>
        ) : totalLotes === 0 && aparelhosLoja.length === 0 ? (
          <AtacadoEmptyState
            icon={Smartphone}
            title={busca ? "Nenhum aparelho encontrado" : "Sem aparelhos cadastrados"}
            description={
              busca
                ? "Tente outro termo de busca (modelo ou IMEI)."
                : "Cadastre o primeiro aparelho — uma unidade por IMEI."
            }
            ctaLabel={!busca ? "Cadastrar aparelho" : undefined}
            ctaOnClick={() => setNovoOpen(true)}
          />
        ) : (
          <>
            {aparelhos.length > 0 && viewMode === "unidade" && (
              <div className="border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Modelo</th>
                      <th className="text-center px-4 py-3 font-medium">Qtd</th>
                      <th className="text-right px-4 py-3 font-medium">Custo unit.</th>
                      <th className="text-right px-4 py-3 font-medium">Preço sugerido</th>
                      <th className="text-right px-4 py-3 font-medium">Lucro</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="px-2 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>{aparelhos.map((a: any) => renderLinha(a))}</tbody>
                </table>
              </div>
            )}

            {aparelhos.length > 0 && viewMode === "modelo" && (
              <div className="space-y-3">
                <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                  Ordenar por:
                  <Select
                    value={grupoSort}
                    onValueChange={(v) => setGrupoSort(v as "valor" | "qtd")}
                  >
                    <SelectTrigger className="h-8 w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor">Valor de venda</SelectItem>
                      <SelectItem value="qtd">Quantidade em estoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border rounded-lg overflow-hidden bg-card divide-y">
                  {grupos.map((g) => {
                    const open = expandidos.has(g.key);
                    const [modelo, capacidade, cor] = g.key.split("|");
                    return (
                      <div key={g.key}>
                        <button
                          type="button"
                          onClick={() => toggleGrupo(g.key)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">
                                {modelo} {capacidade} {cor}{" "}
                                <span className="text-muted-foreground font-normal">
                                  · {g.qtdEmEstoque} un em estoque
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                custo médio {formatBRL(g.custoMedio)}
                                {g.ticketMedio > 0 &&
                                  ` · ticket médio ${formatBRL(g.ticketMedio)}`}
                                {Number.isFinite(g.precoMin) &&
                                  ` · a partir de ${formatBRL(g.precoMin)}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-success tabular-nums">
                              {formatBRL(g.valorVendavel)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              vendável · {g.itens.length} lote{g.itens.length > 1 ? "s" : ""}
                            </p>
                          </div>
                        </button>
                        {open && (
                          <table className="w-full text-sm bg-muted/10">
                            <tbody>{g.itens.map((a: any) => renderLinha(a))}</tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {compartilhado && aparelhosLoja.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Disponível da Loja (compartilhado) ·{" "}
                  <Badge variant="secondary">{aparelhosLoja.length}</Badge>
                </div>
                <div className="border rounded-lg bg-muted/20 divide-y">
                  {aparelhosLoja.slice(0, 5).map((a: any) => (
                    <div
                      key={a.id}
                      className="flex justify-between items-center px-4 py-2.5 text-sm"
                    >
                      <span>
                        {a.modelo} {a.capacidade ?? ""}{" "}
                        <span className="text-xs text-muted-foreground font-mono">
                          · IMEI {a.imei_1?.slice(-4) ?? "—"}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatBRL(Number(a.preco_venda ?? a.custo))}
                      </span>
                    </div>
                  ))}
                  {aparelhosLoja.length > 5 && (
                    <p className="px-4 py-2 text-xs text-center text-muted-foreground">
                      + {aparelhosLoja.length - 5} aparelhos disponíveis
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <NovaEntradaAtacadoDialog open={novoOpen} onOpenChange={setNovoOpen} />
        <AtacadoAparelhoDetalheSheet
          aparelhoId={detalheId}
          onOpenChange={(v) => !v && setDetalheId(null)}
          statusCatalogo={statusCatalogo}
        />
      </div>
    </TooltipProvider>
  );
}

function KpiBox({
  label,
  valor,
  danger,
  success,
  hint,
}: {
  label: string;
  valor: string;
  danger?: boolean;
  success?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        danger
          ? "border-warning/30 bg-warning/5"
          : success
          ? "border-success/30 bg-success/5"
          : "bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          danger ? "text-warning" : success ? "text-success" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function LocalCard({
  label,
  color,
  local,
}: {
  label: string;
  color: string;
  local: { unidades: number; custo: number; venda: number; lucro: number };
}) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <p className={`text-xs font-medium ${color}`}>{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">
        {local.unidades} <span className="text-xs font-normal text-muted-foreground">un</span>
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
        <span>Custo</span>
        <span className="text-right tabular-nums text-foreground">{formatBRL(local.custo)}</span>
        <span>Venda</span>
        <span className="text-right tabular-nums text-foreground">{formatBRL(local.venda)}</span>
        <span>Lucro</span>
        <span className="text-right tabular-nums text-success">{formatBRL(local.lucro)}</span>
      </div>
    </div>
  );
}

function CopyImei({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copiar IMEI"
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
