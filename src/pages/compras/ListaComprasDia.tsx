import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, Printer, MessageCircle, ChevronDown, Package, Plus, Minus, Trash2, Info, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/format";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type OSItem = { os_id: string; numero: number; cliente: string | null; desde: string | null };
type LinhaConsolidada = {
  peca_chave: string;
  peca_id: string;
  peca_nome: string;
  quantidade_total: number;
  ultimo_custo: number | null;
  os_list: OSItem[];
};
type Ajuste = {
  peca_chave: string;
  peca_nome: string | null;
  qtd_ajustada: number | null;
  comprado: boolean;
  custo_manual: number | null;
  avulso: boolean;
  data_ref: string;
};
type LinhaMesclada = {
  peca_chave: string;
  peca_nome: string;
  quantidade: number;
  custo_unit: number;
  comprado: boolean;
  avulso: boolean;
  os_list: OSItem[];
  ultimo_custo: number | null;
  custo_manual: number | null;
};

function ordenarOSPorAntiga(list: OSItem[]) {
  return [...list].sort((a, b) => {
    const da = a.desde ? new Date(a.desde).getTime() : Infinity;
    const db = b.desde ? new Date(b.desde).getTime() : Infinity;
    return da - db;
  });
}

const hoje = () => format(new Date(), "yyyy-MM-dd");

export default function ListaComprasDia() {
  const dataRef = hoje();

  const { data: consolidado, isLoading: loadCons, refetch: refetchCons, isFetching: fCons } = useQuery({
    queryKey: ["compras-lista-do-dia"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compras_lista_do_dia" as any);
      if (error) throw error;
      return (data ?? []) as LinhaConsolidada[];
    },
  });

  const { data: semPeca = [] } = useQuery({
    queryKey: ["os-aguardando-sem-peca"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("os_aguardando_sem_peca" as any);
      if (error) throw error;
      return ((data as any) ?? []) as Array<{ os_id: string; numero: number; cliente: string | null; aparelho: string | null; desde: string | null }>;
    },
  });
  const [semPecaAberto, setSemPecaAberto] = useState(false);

  const { data: ajustes, isLoading: loadAju, refetch: refetchAju, isFetching: fAju } = useQuery({
    queryKey: ["compras-ajustes", dataRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_lista_ajustes" as any)
        .select("peca_chave,peca_nome,qtd_ajustada,comprado,custo_manual,avulso,data_ref")
        .eq("data_ref", dataRef);
      if (error) throw error;
      return ((data as any) ?? []) as Ajuste[];
    },
  });

  const isLoading = loadCons || loadAju;
  const isFetching = fCons || fAju;
  const refetch = () => { refetchCons(); refetchAju(); };

  const linhas: LinhaMesclada[] = useMemo(() => {
    const ajMap = new Map<string, Ajuste>();
    (ajustes ?? []).forEach((a) => ajMap.set(a.peca_chave.toLowerCase(), a));

    const out: LinhaMesclada[] = [];
    const usados = new Set<string>();

    (consolidado ?? []).forEach((l) => {
      const k = l.peca_chave.toLowerCase();
      usados.add(k);
      const aj = ajMap.get(k);
      const qtd = aj?.qtd_ajustada ?? Number(l.quantidade_total || 0);
      const custo = aj?.custo_manual ?? Number(l.ultimo_custo || 0);
      out.push({
        peca_chave: l.peca_chave,
        peca_nome: l.peca_nome,
        quantidade: Math.max(1, qtd),
        custo_unit: custo,
        comprado: !!aj?.comprado,
        avulso: false,
        os_list: l.os_list || [],
        ultimo_custo: l.ultimo_custo,
        custo_manual: aj?.custo_manual ?? null,
      });
    });

    (ajustes ?? []).forEach((a) => {
      const k = a.peca_chave.toLowerCase();
      if (usados.has(k)) return;
      if (!a.avulso) return;
      out.push({
        peca_chave: a.peca_chave,
        peca_nome: a.peca_nome || a.peca_chave,
        quantidade: Math.max(1, a.qtd_ajustada ?? 1),
        custo_unit: Number(a.custo_manual ?? 0),
        comprado: !!a.comprado,
        avulso: true,
        os_list: [],
        ultimo_custo: null,
        custo_manual: a.custo_manual,
      });
    });

    return out;
  }, [consolidado, ajustes]);

  const kpis = useMemo(() => {
    const distintas = linhas.length;
    const totalItens = linhas.reduce((s, l) => s + l.quantidade, 0);
    const osIds = new Set<string>();
    linhas.forEach((l) => l.os_list.forEach((os) => osIds.add(os.os_id)));
    const custoEstimado = linhas.reduce((s, l) => s + l.quantidade * l.custo_unit, 0);
    const faltaComprar = linhas
      .filter((l) => !l.comprado)
      .reduce((s, l) => s + l.quantidade * l.custo_unit, 0);
    return { distintas, totalItens, osAguardando: osIds.size, custoEstimado, faltaComprar };
  }, [linhas]);

  async function salvarAjuste(payload: Record<string, any>) {
    const { error } = await supabase.rpc("compras_salvar_ajuste" as any, {
      p_payload: { data_ref: dataRef, ...payload },
    });
    if (error) {
      toast.error("Erro ao salvar ajuste");
      return false;
    }
    refetchAju();
    return true;
  }

  // debounce para mudanças de quantidade
  const debounceRef = useRef<Record<string, number>>({});
  function setQuantidadeDebounced(l: LinhaMesclada, novaQtd: number) {
    const k = l.peca_chave;
    window.clearTimeout(debounceRef.current[k]);
    debounceRef.current[k] = window.setTimeout(() => {
      salvarAjuste({
        peca_chave: l.peca_chave,
        peca_nome: l.peca_nome,
        qtd_ajustada: String(novaQtd),
        comprado: l.comprado,
        custo_manual: l.custo_manual != null ? String(l.custo_manual) : "",
        avulso: l.avulso,
      });
    }, 500);
  }

  // estado local otimista de quantidade
  const [qtdLocal, setQtdLocal] = useState<Record<string, number>>({});
  useEffect(() => { setQtdLocal({}); }, [ajustes, consolidado]);

  function getQtd(l: LinhaMesclada) {
    return qtdLocal[l.peca_chave] ?? l.quantidade;
  }
  function inc(l: LinhaMesclada) {
    const novo = getQtd(l) + 1;
    setQtdLocal((m) => ({ ...m, [l.peca_chave]: novo }));
    setQuantidadeDebounced(l, novo);
  }
  function dec(l: LinhaMesclada) {
    const novo = Math.max(1, getQtd(l) - 1);
    setQtdLocal((m) => ({ ...m, [l.peca_chave]: novo }));
    setQuantidadeDebounced(l, novo);
  }
  async function toggleComprado(l: LinhaMesclada, v: boolean) {
    await salvarAjuste({
      peca_chave: l.peca_chave,
      peca_nome: l.peca_nome,
      qtd_ajustada: String(getQtd(l)),
      comprado: v,
      custo_manual: l.custo_manual != null ? String(l.custo_manual) : "",
      avulso: l.avulso,
    });
  }
  async function removerAvulso(l: LinhaMesclada) {
    const { error } = await supabase.rpc("compras_remover_avulso" as any, {
      p_peca_chave: l.peca_chave,
      p_data: dataRef,
    });
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Item removido");
    refetchAju();
  }

  // form avulso
  const [novoNome, setNovoNome] = useState("");
  const [novaQtd, setNovaQtd] = useState<string>("1");
  const [novoCusto, setNovoCusto] = useState<string>("");
  async function adicionarAvulso() {
    const nome = novoNome.trim();
    if (!nome) { toast.error("Informe o nome da peça"); return; }
    const qtd = Math.max(1, parseInt(novaQtd) || 1);
    const custo = parseFloat(novoCusto.replace(",", ".")) || 0;
    const chave = `avulso:${nome.toLowerCase()}`;
    const ok = await salvarAjuste({
      peca_chave: chave,
      peca_nome: nome,
      qtd_ajustada: String(qtd),
      comprado: false,
      custo_manual: String(custo),
      avulso: true,
    });
    if (ok) {
      setNovoNome(""); setNovaQtd("1"); setNovoCusto("");
      toast.success("Peça adicionada");
    }
  }

  function montarTexto() {
    const linhasTxt = linhas.map((l) => {
      const marca = l.comprado ? "✅ " : "• ";
      const qtd = getQtd(l);
      const sub = qtd * l.custo_unit;
      const av = l.avulso ? " (avulso)" : "";
      return `${marca}${qtd}× ${l.peca_nome}${av} — ${formatCurrency(sub)}`;
    });
    return [
      `📋 Lista de compras do dia — ${format(new Date(), "dd/MM/yyyy")}`,
      "",
      ...linhasTxt,
      "",
      `Custo estimado: ${formatCurrency(kpis.custoEstimado)}`,
      `Falta comprar: ${formatCurrency(kpis.faltaComprar)}`,
      `Total: ${kpis.totalItens} itens · ${kpis.distintas} peças · ${kpis.osAguardando} OS aguardando`,
      ``,
      `* Estimativa baseada no último custo de cada peça.`,
    ].join("\n");
  }

  function imprimirLista() {
    const texto = montarTexto().replace(/\n/g, "<br/>");
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Lista de compras</title>
      <style>body{font-family:ui-sans-serif,system-ui;padding:24px;color:#000;background:#fff;font-size:14px;line-height:1.6}@media print{body{padding:0}}</style>
      </head><body>${texto}<script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  }

  function enviarWhatsApp() {
    const tel = window.prompt("WhatsApp do fornecedor (DDD + número):", "");
    if (!tel) return;
    abrirWhatsApp(tel, montarTexto());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lista de compras do dia</h2>
          <p className="text-sm text-muted-foreground">
            Peças consolidadas das OS em "aguardando peças" + itens avulsos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={imprimirLista} disabled={!linhas.length}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={enviarWhatsApp} disabled={!linhas.length}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Peças distintas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{kpis.distintas}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de itens</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{kpis.totalItens}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">OS aguardando</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{kpis.osAguardando}</CardContent>
        </Card>
        <Card className="border-primary/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Custo estimado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-primary">{formatCurrency(kpis.custoEstimado)}</CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Estimativa baseada no último custo de cada peça. O valor real pode variar na compra.</span>
      </div>

      {semPeca.length > 0 && (
        <Collapsible open={semPecaAberto} onOpenChange={setSemPecaAberto}>
          <div className="rounded-md border border-warning/40 bg-warning/5">
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 p-3 text-left">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <span className="font-medium text-warning">
                  {semPeca.length} OS aguardando peça sem peça especificada
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  — clique para revisar e lançar a peça.
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${semPecaAberto ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-warning/30 divide-y divide-warning/20">
                {semPeca.map((o) => (
                  <Link
                    key={o.os_id}
                    to={`/assistencia?os=${o.os_id}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 hover:bg-warning/10 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-medium">#{String(o.numero).padStart(3, "0")}</span>
                      <span className="truncate">{o.cliente ?? "—"}</span>
                      <span className="text-muted-foreground truncate hidden sm:inline">{o.aparelho ?? ""}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {o.desde ? `há ${formatDistanceToNow(new Date(o.desde), { locale: ptBR })}` : "sem data"}
                    </span>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}


      {/* Adicionar peça avulsa */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Adicionar peça avulsa</label>
            <Input placeholder="Nome da peça" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          </div>
          <div className="w-24">
            <label className="text-xs text-muted-foreground">Qtd</label>
            <Input type="number" min={1} value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Custo unit.</label>
            <Input placeholder="0,00" value={novoCusto} onChange={(e) => setNovoCusto(e.target.value)} />
          </div>
          <Button onClick={adicionarAvulso}><Plus className="h-4 w-4" /> Adicionar</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : linhas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhuma peça pendente — nenhuma OS aguardando peças no momento.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {linhas.map((l) => {
              const qtd = getQtd(l);
              const sub = qtd * l.custo_unit;
              const osOrd = ordenarOSPorAntiga(l.os_list);
              return (
                <Collapsible key={l.peca_chave}>
                  <div className={`flex items-center gap-3 p-3 ${l.comprado ? "opacity-50" : ""}`}>
                    <Checkbox
                      checked={l.comprado}
                      onCheckedChange={(v) => toggleComprado(l, !!v)}
                    />
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => dec(l)} disabled={qtd <= 1}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Badge variant="secondary" className="font-semibold min-w-[2.25rem] justify-center">{qtd}×</Badge>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => inc(l)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${l.comprado ? "line-through" : ""}`}>
                        {l.peca_nome}
                        {l.avulso && <Badge variant="outline" className="ml-2 text-[10px]">avulso</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Unit.: {formatCurrency(l.custo_unit)} · Subtotal: <span className="font-medium text-foreground">{formatCurrency(sub)}</span>
                      </div>
                    </div>
                    {l.avulso ? (
                      <Button variant="ghost" size="icon" onClick={() => removerAvulso(l)} title="Remover">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {osOrd.length} OS <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                  {!l.avulso && (
                    <CollapsibleContent>
                      <div className="bg-muted/30 px-4 py-2 text-sm divide-y">
                        {osOrd.map((os) => (
                          <div key={os.os_id} className="py-1.5 flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">OS #{os.numero}</span>
                            <span className="flex-1 truncate text-muted-foreground">{os.cliente || "—"}</span>
                            <span className="text-xs text-muted-foreground">
                              {os.desde ? format(new Date(os.desde), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              );
            })}
          </CardContent>
          <div className="border-t bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Falta comprar</span>
            <span className="text-lg font-semibold text-primary">{formatCurrency(kpis.faltaComprar)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
