import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Store, LogIn, ShoppingCart, Plus, Minus, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/utils";

interface Sessao {
  acessoId: string;
  clienteId: string;
  empresaId: string;
  clienteNome: string;
}

interface ItemCarrinho {
  aparelho_id: string;
  modelo: string;
  capacidade: string | null;
  cor: string | null;
  quantidade: number;
  preco_unitario: number;
  estoque_disponivel: number;
}

export default function CatalogoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem(`catalogo-${slug}`);
    if (stored) setSessao(JSON.parse(stored));
  }, [slug]);

  const { data: config, isLoading } = useQuery({
    queryKey: ["catalogo-config", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_get_config", {
        p_slug: slug!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!slug,
  });

  if (isLoading)
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );

  if (!config) {
    return (
      <Centered>
        <Card className="p-8 text-center max-w-md">
          <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h1 className="font-semibold">Catálogo não encontrado</h1>
        </Card>
      </Centered>
    );
  }

  if (!config.catalogo_publico_ativo) {
    return (
      <Centered>
        <Card className="p-8 text-center max-w-md">
          <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h1 className="font-semibold">Catálogo temporariamente desativado</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Volte mais tarde ou contate o fornecedor
          </p>
        </Card>
      </Centered>
    );
  }

  if (!sessao) {
    return (
      <Login
        slug={slug!}
        config={config}
        onLogin={(s: Sessao) => {
          setSessao(s);
          sessionStorage.setItem(`catalogo-${slug}`, JSON.stringify(s));
        }}
      />
    );
  }

  return (
    <CatalogoLogado
      sessao={sessao}
      config={config}
      carrinho={carrinho}
      setCarrinho={setCarrinho}
      onLogout={() => {
        sessionStorage.removeItem(`catalogo-${slug}`);
        setSessao(null);
        setCarrinho([]);
      }}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {children}
    </div>
  );
}

function Login({ slug, config, onLogin }: any) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const login = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_login", {
        p_slug: slug,
        p_email: email.toLowerCase(),
        p_senha: senha,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data: any) => {
      onLogin({
        acessoId: data.acesso_id,
        clienteId: data.cliente_id,
        empresaId: data.empresa_id,
        clienteNome: data.cliente_nome,
      });
    },
    onError: (e: any) => setErro(e.message),
  });

  return (
    <Centered>
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <Store className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-xl font-bold">
            {config.catalogo_publico_titulo ?? "Catálogo B2B"}
          </h1>
          {config.catalogo_publico_descricao && (
            <p className="text-sm text-muted-foreground">
              {config.catalogo_publico_descricao}
            </p>
          )}
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setErro("");
            login.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          {erro && (
            <p className="text-sm text-destructive">{erro}</p>
          )}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" /> Entrar
              </>
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          Não tem acesso? Entre em contato com seu vendedor.
        </p>
      </Card>
    </Centered>
  );
}

function CatalogoLogado({
  sessao, config, carrinho, setCarrinho, onLogout,
}: any) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [sucesso, setSucesso] = useState<{ numero: number } | null>(null);

  const { data: cliente } = useQuery({
    queryKey: ["catalogo-cliente", sessao.clienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_clientes")
        .select("tabela_preco_id, condicao_pagamento_padrao")
        .eq("id", sessao.clienteId)
        .maybeSingle();
      return data;
    },
  });

  const { data: aparelhos = [] } = useQuery({
    queryKey: ["catalogo-aparelhos", sessao.empresaId, cliente?.tabela_preco_id],
    queryFn: async () => {
      const { data: aps } = await supabase
        .from("atacado_aparelhos")
        .select("*")
        .eq("empresa_id", sessao.empresaId)
        .eq("status", "estoque")
        .gt("quantidade", 0)
        .is("deleted_at", null);

      if (!cliente?.tabela_preco_id) return aps ?? [];

      const { data: itens } = await supabase
        .from("atacado_tabelas_preco_itens")
        .select("modelo, capacidade, preco, preco_minimo_qtd_5, preco_minimo_qtd_10")
        .eq("tabela_preco_id", cliente.tabela_preco_id);

      return (aps ?? []).map((a: any) => {
        const it = itens?.find(
          (i: any) =>
            i.modelo === a.modelo &&
            (i.capacidade === a.capacidade || !i.capacidade)
        );
        return {
          ...a,
          preco_aplicado: it?.preco ?? a.preco_sugerido,
          preco_5: it?.preco_minimo_qtd_5,
          preco_10: it?.preco_minimo_qtd_10,
        };
      });
    },
    enabled: !!cliente,
  });

  const calcPreco = (a: any, qtd: number) => {
    if (qtd >= 10 && a.preco_10) return Number(a.preco_10);
    if (qtd >= 5 && a.preco_5) return Number(a.preco_5);
    return Number(a.preco_aplicado ?? a.preco_sugerido ?? a.custo);
  };

  const adicionar = (a: any) => {
    const existe = carrinho.find((c: ItemCarrinho) => c.aparelho_id === a.id);
    if (existe) {
      setCarrinho(
        carrinho.map((c: ItemCarrinho) =>
          c.aparelho_id === a.id
            ? {
                ...c,
                quantidade: Math.min(c.quantidade + 1, c.estoque_disponivel),
                preco_unitario: calcPreco(a, c.quantidade + 1),
              }
            : c
        )
      );
      return;
    }
    setCarrinho([
      ...carrinho,
      {
        aparelho_id: a.id,
        modelo: a.modelo,
        capacidade: a.capacidade,
        cor: a.cor,
        quantidade: 1,
        preco_unitario: calcPreco(a, 1),
        estoque_disponivel: a.quantidade,
      },
    ]);
  };

  const atualizarQtd = (id: string, nova: number) => {
    setCarrinho(
      carrinho
        .map((c: ItemCarrinho) => {
          if (c.aparelho_id !== id) return c;
          const a = aparelhos.find((x: any) => x.id === id);
          const q = Math.max(0, Math.min(nova, c.estoque_disponivel));
          if (q === 0) return null;
          return { ...c, quantidade: q, preco_unitario: calcPreco(a, q) };
        })
        .filter(Boolean) as ItemCarrinho[]
    );
  };

  const subtotal = carrinho.reduce(
    (s: number, c: ItemCarrinho) => s + c.quantidade * c.preco_unitario,
    0
  );

  const enviarPedido = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_criar_pedido", {
        p_acesso_id: sessao.acessoId,
        p_itens: carrinho.map((c: ItemCarrinho) => ({
          aparelho_id: c.aparelho_id,
          modelo: c.modelo,
          capacidade: c.capacidade,
          cor: c.cor,
          quantidade: c.quantidade,
          preco_unitario: c.preco_unitario,
          total_item: c.quantidade * c.preco_unitario,
        })),
        p_observacoes: observacoes || null,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data: any) => {
      setSucesso({ numero: data.numero_pedido });
      setCarrinho([]);
      setObservacoes("");
      setCheckoutOpen(false);
    },
  });

  if (sucesso) {
    return (
      <Centered>
        <Card className="p-8 text-center max-w-md space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
          <h1 className="text-xl font-bold">Pedido enviado!</h1>
          <p className="text-sm">
            Número: <span className="font-mono font-semibold">
              #P-{String(sucesso.numero).padStart(6, "0")}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Seu pedido vai para aprovação. Você receberá retorno em breve.
          </p>
          <Button onClick={() => setSucesso(null)}>Fazer novo pedido</Button>
        </Card>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Store className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold truncate">
                {config.catalogo_publico_titulo ?? "Catálogo B2B"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {sessao.clienteNome}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCheckoutOpen(true)}
              disabled={carrinho.length === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-1" /> Carrinho ({carrinho.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {aparelhos.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum produto disponível no momento
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aparelhos.map((a: any) => {
              const noCart = carrinho.find(
                (c: ItemCarrinho) => c.aparelho_id === a.id
              );
              return (
                <Card key={a.id} className="p-4 space-y-2">
                  <div>
                    <p className="font-semibold">
                      {a.modelo} {a.capacidade ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.cor ?? ""} · {a.quantidade} disponíveis
                    </p>
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatBRL(Number(a.preco_aplicado ?? a.preco_sugerido))}
                  </p>
                  {a.preco_5 && (
                    <p className="text-xs text-muted-foreground">
                      5+: {formatBRL(Number(a.preco_5))} · 10+:{" "}
                      {a.preco_10 ? formatBRL(Number(a.preco_10)) : "—"}
                    </p>
                  )}

                  {noCart ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => atualizarQtd(a.id, noCart.quantidade - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          className="h-8 w-14 text-center"
                          type="number"
                          value={noCart.quantidade}
                          onChange={(e) =>
                            atualizarQtd(a.id, parseInt(e.target.value) || 0)
                          }
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => atualizarQtd(a.id, noCart.quantidade + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-semibold text-sm">
                        {formatBRL(noCart.quantidade * noCart.preco_unitario)}
                      </span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => adicionar(a)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revisar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {carrinho.map((c: ItemCarrinho, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm border-b pb-2"
              >
                <span>
                  {c.quantidade}× {c.modelo} {c.capacidade ?? ""}
                </span>
                <span className="font-semibold">
                  {formatBRL(c.quantidade * c.preco_unitario)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold text-primary">
              {formatBRL(subtotal)}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Condição de pagamento:{" "}
            {cliente?.condicao_pagamento_padrao ?? "a combinar"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={() => enviarPedido.mutate()}
              disabled={enviarPedido.isPending}
            >
              {enviarPedido.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enviar pedido"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
