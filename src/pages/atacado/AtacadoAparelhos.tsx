import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Smartphone, Plus, Search, Package, AlertCircle, Loader2 } from "lucide-react";
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
import { NovaEntradaAtacadoDialog } from "@/components/atacado/NovaEntradaAtacadoDialog";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";
import {
  AtacadoStatusBadge,
  getStatusCategoria,
} from "@/components/atacado/AtacadoStatusBadge";
import { AtacadoAparelhoDetalheSheet } from "@/components/atacado/AtacadoAparelhoDetalheSheet";

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function AtacadoAparelhos() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounced(busca, 300);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

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
    0
  );
  const valorEstoque = aparelhos.reduce(
    (s: number, a: any) => s + a.quantidade * Number(a.custo),
    0
  );
  const lotesBaixoEstoque = aparelhos.filter(
    (a: any) =>
      getStatusCategoria(a.status, statusCatalogo) === "em_estoque" &&
      a.quantidade <= 2,
  ).length;

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Lotes" valor={String(totalLotes)} />
          <KpiBox label="Unidades" valor={String(totalUnidades)} />
          <KpiBox label="Valor estocado" valor={formatBRL(valorEstoque)} />
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
            <SelectTrigger className="w-full sm:w-[180px]">
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
            {aparelhos.length > 0 && (
              <div className="border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Modelo</th>
                      <th className="text-center px-4 py-3 font-medium">Qtd</th>
                      <th className="text-right px-4 py-3 font-medium">Custo unit.</th>
                      <th className="text-right px-4 py-3 font-medium">Preço sugerido</th>
                      <th className="text-right px-4 py-3 font-medium">Markup</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aparelhos.map((a: any) => {
                      const markup =
                        a.preco_sugerido && Number(a.custo) > 0
                          ? ((Number(a.preco_sugerido) - Number(a.custo)) / Number(a.custo)) * 100
                          : 0;
                      const diasParado = a.data_entrada
                        ? Math.floor(
                            (Date.now() - new Date(a.data_entrada).getTime()) / 86400000
                          )
                        : 0;
                      const cat = getStatusCategoria(a.status, statusCatalogo);
                      const baixo = cat === "em_estoque" && a.quantidade <= 2;
                      const lento = cat === "em_estoque" && diasParado > 30;
                      const imeiTail = a.imei_1 ? `· IMEI …${String(a.imei_1).slice(-4)}` : "";
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
                            <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                              <span>{a.fornecedor?.nome ?? "—"}</span>
                              {imeiTail && <span className="font-mono">{imeiTail}</span>}
                              {a.data_entrada && <span>· há {diasParado}d</span>}
                              {baixo && (
                                <span className="text-warning">· estoque baixo</span>
                              )}
                              {lento && (
                                <span className="text-destructive">· giro lento</span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                baixo
                                  ? "bg-warning/15 text-warning border-warning/30"
                                  : ""
                              }
                            >
                              {a.quantidade}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatBRL(Number(a.custo))}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {a.preco_sugerido ? (
                              formatBRL(Number(a.preco_sugerido))
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {markup > 0 ? (
                              <span
                                className={
                                  markup >= 15 ? "text-success" : "text-warning"
                                }
                              >
                                {markup.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <AtacadoStatusBadge
                              status={a.status}
                              catalogo={statusCatalogo}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
}: {
  label: string;
  valor: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        danger ? "border-warning/30 bg-warning/5" : "bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {danger && <AlertCircle className="h-3 w-3 text-warning" />}
        {label}
      </p>
      <p
        className={`text-lg font-bold mt-1 ${
          danger ? "text-warning" : "text-foreground"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
