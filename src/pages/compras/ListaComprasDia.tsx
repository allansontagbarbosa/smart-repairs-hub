import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw, Printer, MessageCircle, ChevronDown, Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type OSItem = { os_id: string; numero: number; cliente: string | null; desde: string | null };
type LinhaCompra = {
  peca_chave: string;
  peca_id: string;
  peca_nome: string;
  quantidade_total: number;
  ultimo_custo: number | null;
  os_list: OSItem[];
};

function ordenarOSPorAntiga(list: OSItem[]) {
  return [...list].sort((a, b) => {
    const da = a.desde ? new Date(a.desde).getTime() : Infinity;
    const db = b.desde ? new Date(b.desde).getTime() : Infinity;
    return da - db;
  });
}

export default function ListaComprasDia() {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["compras-lista-do-dia"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compras_lista_do_dia" as any);
      if (error) throw error;
      return (data ?? []) as LinhaCompra[];
    },
  });

  const linhas = data ?? [];

  const kpis = useMemo(() => {
    const distintas = linhas.length;
    const totalItens = linhas.reduce((s, l) => s + Number(l.quantidade_total || 0), 0);
    const osIds = new Set<string>();
    linhas.forEach((l) => l.os_list?.forEach((os) => osIds.add(os.os_id)));
    return { distintas, totalItens, osAguardando: osIds.size };
  }, [linhas]);

  function montarTexto() {
    const linhasTxt = linhas.map((l) => {
      const marca = marcados[l.peca_chave] ? "✅ " : "• ";
      return `${marca}${l.quantidade_total}× ${l.peca_nome}`;
    });
    return [
      `📋 Lista de compras do dia — ${format(new Date(), "dd/MM/yyyy")}`,
      "",
      ...linhasTxt,
      "",
      `Total: ${kpis.totalItens} itens · ${kpis.distintas} peças · ${kpis.osAguardando} OS aguardando`,
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
            Peças consolidadas das OS em "aguardando peças".
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={imprimirLista} disabled={!linhas.length}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={enviarWhatsApp} disabled={!linhas.length}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button size="sm" disabled>
                    Gerar pedido de compra
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>em breve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

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
              const marcado = !!marcados[l.peca_chave];
              const osOrd = ordenarOSPorAntiga(l.os_list || []);
              return (
                <Collapsible key={l.peca_chave}>
                  <div className={`flex items-center gap-3 p-3 ${marcado ? "opacity-60" : ""}`}>
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(v) => setMarcados((m) => ({ ...m, [l.peca_chave]: !!v }))}
                    />
                    <Badge variant="secondary" className="font-semibold">{l.quantidade_total}×</Badge>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${marcado ? "line-through" : ""}`}>{l.peca_nome}</div>
                      {l.ultimo_custo != null && (
                        <div className="text-xs text-muted-foreground">
                          Último custo: {formatCurrency(Number(l.ultimo_custo))}
                        </div>
                      )}
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {osOrd.length} OS <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
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
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
