import { useState, useEffect } from "react";
import { Search, Scan, X, Zap, Users, FileText, Maximize2, Store, ShoppingCart, Loader2, CheckCircle2, Printer, Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { NovoAparelhoDialog } from "@/components/loja/NovoAparelhoDialog";
import { ClienteSelectDialog } from "@/components/loja/ClienteSelectDialog";

interface CartItem {
  aparelho_id: string;
  modelo: string;
  imei: string;
  preco: number;
}

type FormaPagto = "dinheiro" | "pix" | "cartao" | "crediario";

export default function LojaPDV() {
  const { empresaId } = useEmpresa();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [novoAparelhoOpen, setNovoAparelhoOpen] = useState(false);
  const [clienteOpen, setClienteOpen] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [tradeIn] = useState(0);
  const [desconto] = useState(0);
  const [formaPagto, setFormaPagto] = useState<FormaPagto>("pix");
  const [parcelasCartao, setParcelasCartao] = useState(1);
  const [parcelasCrediario, setParcelasCrediario] = useState(6);
  const [finalizando, setFinalizando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState<any>(null);

  const { data: meuFuncionario } = useQuery({
    queryKey: ["meu-funcionario", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from("user_profiles")
        .select("funcionario_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.funcionario_id ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: aparelhos = [] } = useQuery({
    queryKey: ["loja-aparelhos-pdv", empresaId, busca],
    queryFn: async () => {
      let query = (supabase as any)
        .from("loja_aparelhos")
        .select("id, modelo, capacidade, cor, imei_1, preco_venda, condicao")
        .eq("empresa_id", empresaId)
        .eq("status", "estoque")
        .is("deleted_at", null)
        .limit(12);

      if (busca) {
        query = query.or(`modelo.ilike.%${busca}%,imei_1.ilike.%${busca}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const subtotal = carrinho.reduce((sum, it) => sum + it.preco, 0);
  const total = subtotal - tradeIn - desconto;

  const handleFinalizar = async () => {
    if (carrinho.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione pelo menos um aparelho.", variant: "destructive" });
      return;
    }
    if (!meuFuncionario) {
      toast({
        title: "Vendedor não identificado",
        description: "Seu usuário não tem funcionário vinculado. Configure em Usuários.",
        variant: "destructive",
      });
      return;
    }
    if (formaPagto === "crediario" && !clienteSelecionado) {
      toast({
        title: "Cliente obrigatório",
        description: "Crediário exige cliente cadastrado. Selecione (F2) ou troque a forma de pagamento.",
        variant: "destructive",
      });
      return;
    }

    setFinalizando(true);
    try {
      const itens = carrinho.map((it) => ({
        aparelho_id: it.aparelho_id,
        preco_unitario: it.preco,
        desconto_item: 0,
      }));

      const parcelas =
        formaPagto === "crediario" ? parcelasCrediario : formaPagto === "cartao" ? parcelasCartao : 1;

      const pagamentos = [
        {
          forma: formaPagto,
          valor: total,
          parcelas,
        },
      ];

      const { data, error } = await (supabase as any).rpc("registrar_venda_loja", {
        p_empresa_id: empresaId,
        p_cliente_id: clienteSelecionado?.id ?? null,
        p_vendedor_id: meuFuncionario,
        p_itens: itens,
        p_pagamentos: pagamentos,
        p_desconto: desconto,
        p_trade_in_id: null,
        p_trade_in_valor: tradeIn,
        p_observacoes: null,
      });

      if (error) throw error;

      const venda = data?.[0];
      setVendaFinalizada({ ...venda, total, formaPagto, itens: carrinho });

      toast({
        title: "✓ Venda finalizada",
        description: `Venda #V-${String(venda.numero_venda).padStart(6, "0")} no valor de ${formatBRL(total)}`,
      });

      qc.invalidateQueries({ queryKey: ["loja-aparelhos-pdv"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-counts"] });
      qc.invalidateQueries({ queryKey: ["loja-vendas"] });
      qc.invalidateQueries({ queryKey: ["loja-vendas-kpis"] });
      qc.invalidateQueries({ queryKey: ["loja-dashboard-kpis"] });
      qc.invalidateQueries({ queryKey: ["loja-crediario"] });

      setCarrinho([]);
      setClienteSelecionado(null);
      setFormaPagto("pix");
      setParcelasCartao(1);
      setParcelasCrediario(6);
    } catch (err: any) {
      toast({
        title: "Erro ao finalizar venda",
        description: err.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setFinalizando(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); document.getElementById("pdv-search")?.focus(); }
      if (e.key === "F2") { e.preventDefault(); setClienteOpen(true); }
      if (e.key === "F4" && carrinho.length > 0 && !finalizando) { e.preventDefault(); handleFinalizar(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrinho, finalizando, formaPagto, parcelasCartao, parcelasCrediario, clienteSelecionado, total, meuFuncionario]);

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">PDV — Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Venda rápida · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setClienteOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            {clienteSelecionado ? clienteSelecionado.nome.split(" ")[0] : "Cliente"}
            <kbd className="ml-2 text-[10px] opacity-60">F2</kbd>
          </Button>
          <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" /> Pendentes</Button>
          <Button variant="outline" size="sm"><Maximize2 className="h-4 w-4 mr-2" /> Tela cheia</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* ESQUERDA */}
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="pdv-search"
              placeholder="Buscar por modelo, IMEI ou escanear código de barras..."
              className="pl-10 pr-24 h-12"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">F1</Badge>
              <Button size="sm" variant="ghost" className="h-8 px-2"><Scan className="h-4 w-4 mr-1" /> Scan</Button>
            </div>
          </div>

          {aparelhos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Store className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Estoque vazio</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Cadastre aparelhos na seção Aparelhos pra começar a vender.
              </p>
              <Button onClick={() => setNovoAparelhoOpen(true)}><Plus className="h-4 w-4 mr-2" /> Cadastrar aparelho</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {aparelhos.map((ap: any) => (
                <button
                  key={ap.id}
                  onClick={() => setCarrinho([...carrinho, {
                    aparelho_id: ap.id,
                    modelo: `${ap.modelo} ${ap.capacidade ?? ""}`,
                    imei: ap.imei_1 ?? "",
                    preco: Number(ap.preco_venda ?? 0),
                  }])}
                  className="bg-card border rounded-xl p-3 text-left hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <div className="text-2xl mb-2">📱</div>
                  <p className="text-sm font-semibold truncate">{ap.modelo} · {ap.capacidade}</p>
                  <p className="text-[10px] text-muted-foreground truncate">IMEI: {ap.imei_1}</p>
                  <p className="text-base font-bold text-primary mt-1 tabular-nums">{formatBRL(Number(ap.preco_venda ?? 0))}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{ap.condicao} · {ap.cor}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DIREITA — Carrinho */}
        <div className="bg-card border rounded-xl p-4 h-fit lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">🛒 Venda atual</h3>
            {clienteSelecionado && (
              <Badge variant="outline" className="text-[10px]">{clienteSelecionado.nome.split(" ")[0]}</Badge>
            )}
          </div>

          {carrinho.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Selecione um aparelho<br />pra começar a venda</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
                {carrinho.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                    <div className="text-xl">📱</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{it.modelo}</p>
                      <p className="text-[10px] text-muted-foreground truncate">IMEI {it.imei}</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums">{formatBRL(it.preco)}</p>
                    <button
                      onClick={() => setCarrinho(carrinho.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1 mb-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBRL(subtotal)}</span></div>
                {tradeIn > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Trade-in</span><span className="tabular-nums">−{formatBRL(tradeIn)}</span></div>}
                {desconto > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span className="tabular-nums">−{formatBRL(desconto)}</span></div>}
                <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2"><span>Total</span><span className="tabular-nums text-primary">{formatBRL(total)}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {(["dinheiro", "pix", "cartao", "crediario"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormaPagto(f)}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                      formaPagto === f
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {f === "dinheiro" ? "💵 Dinheiro" : f === "pix" ? "⚡ Pix" : f === "cartao" ? "💳 Cartão" : "📅 Crediário"}
                  </button>
                ))}
              </div>

              {(formaPagto === "cartao" || formaPagto === "crediario") && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Parcelas:</span>
                  <Select
                    value={String(formaPagto === "cartao" ? parcelasCartao : parcelasCrediario)}
                    onValueChange={(v) =>
                      formaPagto === "cartao" ? setParcelasCartao(parseInt(v)) : setParcelasCrediario(parseInt(v))
                    }
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: formaPagto === "cartao" ? 18 : 12 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatBRL(total / n)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleFinalizar} disabled={finalizando} className="w-full h-12 text-base font-semibold">
                {finalizando ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Finalizar venda <Badge variant="outline" className="ml-2 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30">F4</Badge></>
                )}
              </Button>

              <div className="mt-3 grid grid-cols-4 gap-1 text-[10px] text-muted-foreground text-center">
                <div><kbd className="font-mono">F1</kbd> Buscar</div>
                <div><kbd className="font-mono">F2</kbd> Cliente</div>
                <div><kbd className="font-mono">F3</kbd> Desconto</div>
                <div><kbd className="font-mono">F4</kbd> Finalizar</div>
              </div>
            </>
          )}
        </div>
      </div>

      <NovoAparelhoDialog open={novoAparelhoOpen} onOpenChange={setNovoAparelhoOpen} />

      <ClienteSelectDialog
        open={clienteOpen}
        onOpenChange={setClienteOpen}
        onSelect={(c) => { setClienteSelecionado(c); setClienteOpen(false); }}
      />

      <Dialog open={!!vendaFinalizada} onOpenChange={(o) => !o && setVendaFinalizada(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Venda finalizada
            </DialogTitle>
          </DialogHeader>
          {vendaFinalizada && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">Venda</p>
                <p className="text-2xl font-bold">#V-{String(vendaFinalizada.numero_venda).padStart(6, "0")}</p>
                <p className="text-3xl font-bold text-primary mt-2 tabular-nums">{formatBRL(vendaFinalizada.total)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-2" /> Cupom</Button>
                <Button variant="outline" size="sm"><Send className="h-4 w-4 mr-2" /> Pix</Button>
              </div>
              <Button className="w-full" onClick={() => setVendaFinalizada(null)}>
                <Plus className="h-4 w-4 mr-2" /> Nova venda
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
