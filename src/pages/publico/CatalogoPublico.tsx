import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Store, LogIn, ShoppingCart, Plus, Minus, CheckCircle2, Loader2,
  Search, AlertCircle, Package, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

interface Grupo {
  grupo_key: string;
  modelo: string;
  capacidade: string | null;
  cor: string | null;
  grade: string | null;
  condicao: string | null;
  quantidade: number;
  preco_aplicado: number | null;
  preco_5: number | null;
  preco_10: number | null;
  cliente_nome: string;
  condicao_pagamento_padrao: string | null;
  tabela_preco_id: string | null;
}

interface ItemCarrinho {
  grupo_key: string;
  modelo: string;
  capacidade: string | null;
  cor: string | null;
  grade: string | null;
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
            {config.catalogo_publico_titulo || "Catálogo B2B"}
          </h1>
          {config.catalogo_publico_descricao && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {config.catalogo_publico_descricao}
            </p>
          )}
        </div>

        <div
          className="space-y-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && email && senha && !login.isPending) {
              setErro("");
              login.mutate();
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button
            className="w-full"
            disabled={login.isPending || !email || !senha}
            onClick={() => {
              setErro("");
              login.mutate();
            }}
          >
            {login.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" /> Entrar
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Não tem acesso? Entre em contato com seu vendedor.
        </p>
      </Card>
    </Centered>
  );
}

type OrdenarPor = "modelo" | "preco_asc" | "preco_desc" | "disponivel_desc";

function CatalogoLogado({
  sessao, config, carrinho, setCarrinho, onLogout,
}: any) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [sucesso, setSucesso] = useState<{ numero: number } | null>(null);
  const [busca, setBusca] = useState("");
  const [ordenar, setOrdenar] = useState<OrdenarPor>("modelo");
  const [tab, setTab] = useState("catalogo");

  const aparelhosQuery = useQuery({
    queryKey: ["catalogo-aparelhos-rpc", sessao.acessoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "catalogo_listar_aparelhos" as any,
        { p_acesso_id: sessao.acessoId },
      );
      if (error) throw error;
      return (data as Grupo[]) ?? [];
    },
  });

  const grupos: Grupo[] = aparelhosQuery.data ?? [];
  const clienteInfo = grupos[0] ?? null;

  const pedidosQuery = useQuery({
    queryKey: ["catalogo-pedidos-rpc", sessao.acessoId, tab],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "catalogo_listar_pedidos" as any,
        { p_acesso_id: sessao.acessoId },
      );
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: tab === "pedidos",
  });

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let arr = grupos;
    if (termo) {
      arr = arr.filter((g) =>
        [g.modelo, g.capacidade, g.cor, g.grade, g.condicao]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(termo),
      );
    }
    const sorted = [...arr];
    if (ordenar === "preco_asc")
      sorted.sort((a, b) => (Number(a.preco_aplicado) || 0) - (Number(b.preco_aplicado) || 0));
    else if (ordenar === "preco_desc")
      sorted.sort((a, b) => (Number(b.preco_aplicado) || 0) - (Number(a.preco_aplicado) || 0));
    else if (ordenar === "disponivel_desc")
      sorted.sort((a, b) => b.quantidade - a.quantidade);
    return sorted;
  }, [grupos, busca, ordenar]);

  const calcPreco = (g: Grupo, qtd: number) => {
    if (qtd >= 10 && g.preco_10) return Number(g.preco_10);
    if (qtd >= 5 && g.preco_5) return Number(g.preco_5);
    return Number(g.preco_aplicado ?? 0);
  };

  const adicionar = (g: Grupo) => {
    const existe = carrinho.find((c: ItemCarrinho) => c.grupo_key === g.grupo_key);
    if (existe) {
      setCarrinho(
        carrinho.map((c: ItemCarrinho) =>
          c.grupo_key === g.grupo_key
            ? {
                ...c,
                quantidade: Math.min(c.quantidade + 1, c.estoque_disponivel),
                preco_unitario: calcPreco(g, Math.min(c.quantidade + 1, c.estoque_disponivel)),
              }
            : c,
        ),
      );
      return;
    }
    setCarrinho([
      ...carrinho,
      {
        grupo_key: g.grupo_key,
        modelo: g.modelo,
        capacidade: g.capacidade,
        cor: g.cor,
        grade: g.grade,
        quantidade: 1,
        preco_unitario: calcPreco(g, 1),
        estoque_disponivel: g.quantidade,
      },
    ]);
  };

  const atualizarQtd = (key: string, nova: number) => {
    setCarrinho(
      carrinho
        .map((c: ItemCarrinho) => {
          if (c.grupo_key !== key) return c;
          const g = grupos.find((x) => x.grupo_key === key);
          const q = Math.max(0, Math.min(nova, c.estoque_disponivel));
          if (q === 0) return null;
          return { ...c, quantidade: q, preco_unitario: g ? calcPreco(g, q) : c.preco_unitario };
        })
        .filter(Boolean) as ItemCarrinho[],
    );
  };

  const subtotal = carrinho.reduce(
    (s: number, c: ItemCarrinho) => s + c.quantidade * c.preco_unitario,
    0,
  );

  const enviarPedido = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_criar_pedido", {
        p_acesso_id: sessao.acessoId,
        p_itens: carrinho.map((c: ItemCarrinho) => ({
          aparelho_id: null,
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
      aparelhosQuery.refetch();
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
            Seu pedido vai para aprovação. Acompanhe em "Meus pedidos".
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => { setSucesso(null); setTab("pedidos"); }}>
              Ver meus pedidos
            </Button>
            <Button onClick={() => setSucesso(null)}>Fazer novo pedido</Button>
          </div>
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
                {config.catalogo_publico_titulo || "Catálogo B2B"}
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
        {config.catalogo_publico_descricao && (
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">
            {config.catalogo_publico_descricao}
          </p>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="catalogo">
              <Package className="h-4 w-4 mr-1" /> Catálogo
            </TabsTrigger>
            <TabsTrigger value="pedidos">
              <Clock className="h-4 w-4 mr-1" /> Meus pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar modelo, cor, capacidade…"
                  className="pl-8"
                />
              </div>
              <Select value={ordenar} onValueChange={(v) => setOrdenar(v as OrdenarPor)}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modelo">Modelo (A→Z)</SelectItem>
                  <SelectItem value="preco_asc">Preço (menor)</SelectItem>
                  <SelectItem value="preco_desc">Preço (maior)</SelectItem>
                  <SelectItem value="disponivel_desc">Mais disponíveis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aparelhosQuery.isLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : aparelhosQuery.isError ? (
              <Card className="p-6 text-center space-y-2 border-destructive/50">
                <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                <p className="font-medium text-sm">Erro ao carregar catálogo</p>
                <p className="text-xs text-muted-foreground">
                  {(aparelhosQuery.error as any)?.message}
                </p>
                <Button size="sm" variant="outline" onClick={() => aparelhosQuery.refetch()}>
                  Tentar novamente
                </Button>
              </Card>
            ) : gruposFiltrados.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {busca
                  ? "Nenhum produto encontrado para a busca"
                  : "Sem produtos disponíveis no momento"}
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {gruposFiltrados.map((g) => {
                  const noCart = carrinho.find(
                    (c: ItemCarrinho) => c.grupo_key === g.grupo_key,
                  );
                  return (
                    <Card key={g.grupo_key} className="p-4 space-y-2 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {g.modelo} {g.capacidade ?? ""}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[g.cor, g.grade, g.condicao].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {g.quantidade} un
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-primary">
                        {g.preco_aplicado ? formatBRL(Number(g.preco_aplicado)) : "Sob consulta"}
                      </p>
                      {(g.preco_5 || g.preco_10) && (
                        <p className="text-xs text-muted-foreground">
                          {g.preco_5 ? `5+: ${formatBRL(Number(g.preco_5))}` : null}
                          {g.preco_5 && g.preco_10 ? " · " : null}
                          {g.preco_10 ? `10+: ${formatBRL(Number(g.preco_10))}` : null}
                        </p>
                      )}

                      <div className="mt-auto pt-2">
                        {noCart ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => atualizarQtd(g.grupo_key, noCart.quantidade - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                className="h-8 w-14 text-center"
                                type="number"
                                value={noCart.quantidade}
                                onChange={(e) =>
                                  atualizarQtd(g.grupo_key, parseInt(e.target.value) || 0)
                                }
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => atualizarQtd(g.grupo_key, noCart.quantidade + 1)}
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
                            onClick={() => adicionar(g)}
                            disabled={!g.preco_aplicado}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Adicionar
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pedidos" className="mt-4">
            {pedidosQuery.isLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pedidosQuery.isError ? (
              <Card className="p-6 text-center space-y-2 border-destructive/50">
                <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                <p className="text-sm">Erro ao carregar pedidos</p>
              </Card>
            ) : (pedidosQuery.data ?? []).length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                Você ainda não fez nenhum pedido
              </Card>
            ) : (
              <div className="space-y-2">
                {(pedidosQuery.data ?? []).map((p: any) => (
                  <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">
                        #P-{String(p.numero_pedido).padStart(6, "0")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("pt-BR")}
                        {p.nfe_numero ? ` · NF-e ${p.nfe_numero}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={p.status} />
                      <p className="text-sm font-semibold mt-1">
                        {formatBRL(Number(p.total))}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
                <span className="truncate pr-2">
                  {c.quantidade}× {c.modelo} {c.capacidade ?? ""}{" "}
                  {c.cor ? `· ${c.cor}` : ""}
                </span>
                <span className="font-semibold shrink-0">
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
            {clienteInfo?.condicao_pagamento_padrao ?? "a combinar"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={() => enviarPedido.mutate()}
              disabled={enviarPedido.isPending || carrinho.length === 0}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    aguardando_aprovacao: { label: "Aguardando aprovação", variant: "secondary" },
    aprovado: { label: "Aprovado", variant: "default" },
    rejeitado: { label: "Rejeitado", variant: "destructive" },
    faturado: { label: "Faturado", variant: "default" },
    pago: { label: "Pago", variant: "default" },
    cancelado: { label: "Cancelado", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
