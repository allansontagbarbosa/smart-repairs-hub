import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone, MessageCircle, Edit, Mail, MapPin, CreditCard, ShoppingBag,
  Loader2, Calendar, Instagram, AlertTriangle, Star, Ban, User as UserIcon,
} from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatBRL, maskCPF } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string | null;
  onEditar?: (id: string) => void;
}

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  crediario: "Crediário",
};

export function ClienteDetalheDrawer({ open, onOpenChange, clienteId, onEditar }: Props) {
  const { empresaId: _empresaId } = useEmpresa();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente-detalhe", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data } = await (supabase as any)
        .from("loja_clientes")
        .select("*")
        .eq("id", clienteId)
        .single();
      return data;
    },
    enabled: open && !!clienteId,
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["cliente-vendas", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data } = await (supabase as any)
        .from("loja_vendas")
        .select(`*, loja_vendas_itens(loja_aparelhos(modelo, capacidade, cor)), loja_pagamentos(forma, parcelas)`)
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open && !!clienteId,
  });

  const { data: crediarios = [] } = useQuery({
    queryKey: ["cliente-crediarios", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data } = await (supabase as any)
        .from("loja_crediario")
        .select(`*, loja_crediario_parcelas(*)`)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open && !!clienteId,
  });

  const totalGasto = vendas.reduce((s: number, v: any) => s + Number(v.total ?? 0), 0);
  const ticketMedio = vendas.length > 0 ? totalGasto / vendas.length : 0;
  const parcelasAtrasadas = crediarios
    .flatMap((c: any) => c.loja_crediario_parcelas ?? [])
    .filter((p: any) => p.status === "atrasada").length;

  const telDigits = (cliente?.telefone ?? "").replace(/\D/g, "");
  const wppLink = telDigits ? `https://wa.me/55${telDigits}` : null;
  const telLink = telDigits ? `tel:+55${telDigits}` : null;

  const iniciais = cliente?.nome
    ? cliente.nome.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading || !cliente ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="sr-only">{cliente.nome}</SheetTitle>
              <SheetDescription className="sr-only">Detalhes do cliente</SheetDescription>

              <div className="flex items-start gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                  {iniciais}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold leading-tight truncate">{cliente.nome}</h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {cliente.cpf ? maskCPF(cliente.cpf) : "—"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <TagBadge tag={cliente.tag} />
                    {parcelasAtrasadas > 0 && (
                      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {parcelasAtrasadas} parcela{parcelasAtrasadas > 1 ? "s" : ""} em atraso
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {(telLink || wppLink) && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {telLink && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={telLink}><Phone className="h-4 w-4 mr-2" /> Ligar</a>
                    </Button>
                  )}
                  {wppLink && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={wppLink} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </SheetHeader>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Kpi label="Total gasto" value={formatBRL(totalGasto)} />
              <Kpi label="Ticket médio" value={formatBRL(ticketMedio)} />
              <Kpi label="Compras" value={String(vendas.length)} />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="dados" className="mt-4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="compras">
                  Compras {vendas.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{vendas.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="crediario">
                  Crediário {crediarios.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{crediarios.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* DADOS */}
              <TabsContent value="dados" className="space-y-4 mt-4">
                <Section title="Contato" icon={<UserIcon className="h-3.5 w-3.5" />}>
                  <Linha icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" valor={cliente.telefone || "—"} />
                  <Linha icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" valor={cliente.email || "—"} />
                  {cliente.instagram && (
                    <Linha icon={<Instagram className="h-3.5 w-3.5" />} label="Instagram" valor={cliente.instagram} />
                  )}
                </Section>

                <Section title="Endereço" icon={<MapPin className="h-3.5 w-3.5" />}>
                  <Linha
                    label="Endereço"
                    valor={
                      [
                        cliente.endereco,
                        cliente.numero,
                        cliente.complemento,
                        cliente.bairro,
                        cliente.cidade && cliente.uf ? `${cliente.cidade}/${cliente.uf}` : cliente.cidade,
                        cliente.cep,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"
                    }
                  />
                </Section>

                <Section title="Financeiro" icon={<CreditCard className="h-3.5 w-3.5" />}>
                  <Linha label="Limite de crédito" valor={cliente.limite_credito ? formatBRL(cliente.limite_credito) : "—"} mono />
                  <Linha label="Renda mensal" valor={cliente.renda_mensal ? formatBRL(cliente.renda_mensal) : "—"} mono />
                  <Linha label="Score interno" valor={`${cliente.score_interno ?? 0}/5`} />
                </Section>

                {cliente.observacoes && (
                  <Section title="Observações">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cliente.observacoes}</p>
                  </Section>
                )}

                {onEditar && (
                  <Button variant="outline" className="w-full" onClick={() => onEditar(cliente.id)}>
                    <Edit className="h-4 w-4 mr-2" /> Editar cliente
                  </Button>
                )}
              </TabsContent>

              {/* COMPRAS */}
              <TabsContent value="compras" className="space-y-2 mt-4">
                {vendas.length === 0 ? (
                  <EmptyMini icon={<ShoppingBag className="h-8 w-8" />} text="Sem compras registradas ainda." />
                ) : (
                  vendas.map((v: any) => {
                    const aparelho = v.loja_vendas_itens?.[0]?.loja_aparelhos;
                    const pagto = v.loja_pagamentos?.map((p: any) =>
                      p.parcelas > 1 ? `${FORMA_LABEL[p.forma] ?? p.forma} ${p.parcelas}x` : (FORMA_LABEL[p.forma] ?? p.forma)
                    ).join(" + ") || "—";
                    return (
                      <div key={v.id} className="rounded-md border p-3 bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">
                            #V-{String(v.numero_venda).padStart(6, "0")}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-primary">{formatBRL(v.total)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {new Date(v.created_at).toLocaleDateString("pt-BR")} ·{" "}
                          {aparelho ? `${aparelho.modelo} ${aparelho.capacidade ?? ""}` : "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{pagto}</p>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* CREDIÁRIO */}
              <TabsContent value="crediario" className="space-y-2 mt-4">
                {crediarios.length === 0 ? (
                  <EmptyMini icon={<CreditCard className="h-8 w-8" />} text="Sem crediário ativo." />
                ) : (
                  crediarios.map((c: any) => {
                    const parcelas = (c.loja_crediario_parcelas ?? []).slice().sort(
                      (a: any, b: any) => a.numero_parcela - b.numero_parcela
                    );
                    const pagas = parcelas.filter((p: any) => p.status === "paga").length;
                    return (
                      <div key={c.id} className="rounded-md border p-3 bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">{c.numero_contrato}</span>
                          <Badge variant={c.status === "aberto" ? "default" : c.status === "quitado" ? "secondary" : "destructive"} className="capitalize text-[10px]">
                            {c.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatBRL(c.total)} · {pagas}/{c.parcelas} parcelas pagas
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Próx. venc: {new Date(c.primeiro_vencimento).toLocaleDateString("pt-BR")}
                        </p>

                        <div className="flex gap-1 mt-2">
                          {parcelas.map((p: any) => (
                            <div
                              key={p.id}
                              title={`Parcela ${p.numero_parcela} · ${p.status} · venc ${new Date(p.vencimento).toLocaleDateString("pt-BR")}`}
                              className={`h-2 flex-1 rounded-sm ${
                                p.status === "paga"
                                  ? "bg-success"
                                  : p.status === "atrasada"
                                  ? "bg-destructive"
                                  : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5 text-center">
      <p className="text-[10px] uppercase text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5 truncate">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: JSX.Element; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
        {icon}
        {title}
      </div>
      <div className="rounded-md border bg-card divide-y">{children}</div>
    </div>
  );
}

function Linha({ label, valor, mono, icon }: { label: string; valor: string; mono?: boolean; icon?: JSX.Element }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
        {icon}
        {label}
      </span>
      <span className={`text-right truncate ${mono ? "tabular-nums font-mono" : ""}`}>{valor}</span>
    </div>
  );
}

function EmptyMini({ icon, text }: { icon: JSX.Element; text: string }) {
  return (
    <div className="py-10 flex flex-col items-center text-center text-muted-foreground">
      <div className="opacity-40 mb-2">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function TagBadge({ tag }: { tag: string }) {
  const map: Record<string, { l: string; cls: string; icon?: JSX.Element }> = {
    vip: { l: "VIP", cls: "bg-warning/15 text-warning border-warning/30", icon: <Star className="h-3 w-3 mr-1" /> },
    regular: { l: "Regular", cls: "bg-muted text-muted-foreground border-transparent" },
    novo: { l: "Novo", cls: "bg-info/15 text-info border-info/30" },
    problema: { l: "Problema", cls: "bg-warning/15 text-warning border-warning/30", icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    blacklist: { l: "Blacklist", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: <Ban className="h-3 w-3 mr-1" /> },
  };
  const m = map[tag] ?? map.regular;
  return (
    <Badge variant="outline" className={`${m.cls} text-[10px]`}>
      {m.icon}
      {m.l}
    </Badge>
  );
}
