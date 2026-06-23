import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  MapPin,
  ClipboardList,
  Edit,
  Ban,
  Loader2,
  User,
  Trash2,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string | null;
}

export function ClienteAtacadoDrawer({ open, onOpenChange, clienteId }: Props) {
  const { empresaId: _empresaId } = useEmpresa();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["atacado-cliente-detalhe", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data } = await supabase
        .from("atacado_clientes" as any)
        .select(
          `*, tabela_preco:atacado_tabelas_preco(id, nome), vendedor:funcionarios(id, nome)`
        )
        .eq("id", clienteId)
        .single();
      return data as any;
    },
    enabled: open && !!clienteId,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["atacado-cliente-pedidos", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data } = await supabase
        .from("atacado_pedidos" as any)
        .select("id, numero_pedido, total, status, created_at")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any[]) ?? [];
    },
    enabled: open && !!clienteId,
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["atacado-cliente-pagamentos", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data } = await supabase
        .from("atacado_pedidos_pagamentos" as any)
        .select(`*, pedido:atacado_pedidos!inner(numero_pedido, cliente_id)`)
        .eq("pedido.cliente_id", clienteId)
        .in("status", ["aberto", "atrasado", "pago"])
        .order("vencimento", { ascending: true })
        .limit(50);
      return (data as any[]) ?? [];
    },
    enabled: open && !!clienteId,
  });

  const totalGasto = pedidos.reduce((s: number, p: any) => s + Number(p.total), 0);
  const ticketMedio = pedidos.length > 0 ? totalGasto / pedidos.length : 0;
  const emAberto = pagamentos
    .filter((p: any) => p.status === "aberto")
    .reduce((s: number, p: any) => s + Number(p.valor), 0);
  const atrasado = pagamentos
    .filter((p: any) => p.status === "atrasado")
    .reduce((s: number, p: any) => s + Number(p.valor), 0);
  const limite = Number(cliente?.limite_credito ?? 0);
  const limiteUsado = emAberto + atrasado;
  const pctLimite = limite > 0 ? (limiteUsado / limite) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {isLoading || !cliente ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="text-xl">
                {cliente.nome_fantasia || cliente.razao_social}
              </SheetTitle>
              {cliente.nome_fantasia && (
                <p className="text-sm text-muted-foreground">{cliente.razao_social}</p>
              )}
              <p className="text-xs font-mono text-muted-foreground">
                {cliente.cnpj ? maskCNPJ(cliente.cnpj) : "Sem CNPJ"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{cliente.tabela_preco?.nome ?? "sem tabela"}</Badge>
                <Badge
                  variant="outline"
                  className={
                    cliente.status === "ativo"
                      ? "bg-success/15 text-success border-success/30"
                      : cliente.status === "bloqueado"
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : cliente.status === "inadimplente"
                      ? "bg-warning/15 text-warning border-warning/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {cliente.status}
                </Badge>
              </div>

              {limite > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Limite usado</span>
                    <span className="font-medium">
                      {formatBRL(limiteUsado)} / {formatBRL(limite)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pctLimite >= 90
                          ? "bg-destructive"
                          : pctLimite >= 70
                          ? "bg-warning"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, pctLimite)}%` }}
                    />
                  </div>
                </div>
              )}
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <Kpi label="Pedidos" valor={String(pedidos.length)} />
              <Kpi label="Total gasto" valor={formatBRL(totalGasto)} />
              <Kpi label="Ticket médio" valor={formatBRL(ticketMedio)} />
            </div>

            <Tabs defaultValue="dados" className="mt-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="pedidos">
                  Pedidos {pedidos.length > 0 && <Badge variant="secondary" className="ml-1">{pedidos.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="financeiro">
                  Financeiro {atrasado > 0 && <span className="ml-1 text-destructive">!</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-2 mt-4">
                <Linha icon={<Phone className="h-4 w-4" />} label="Telefone" valor={cliente.telefone || "—"} />
                <Linha icon={<Mail className="h-4 w-4" />} label="E-mail" valor={cliente.email || "—"} />
                <Linha
                  icon={<User className="h-4 w-4" />}
                  label="Contato"
                  valor={cliente.contato_principal || "—"}
                />
                <Linha
                  icon={<MapPin className="h-4 w-4" />}
                  label="Endereço"
                  valor={`${cliente.endereco ?? ""}${
                    cliente.numero ? ", " + cliente.numero : ""
                  } · ${cliente.cidade ?? "—"}/${cliente.uf ?? "—"}`}
                />
                <Linha label="Vendedor" valor={cliente.vendedor?.nome ?? "—"} />
                <Linha
                  label="Limite / Prazo"
                  valor={`${formatBRL(limite)} · ${
                    cliente.prazo_pagamento_padrao > 0
                      ? cliente.prazo_pagamento_padrao + "d"
                      : "À vista"
                  }`}
                />
                <Linha
                  label="Condição"
                  valor={cliente.condicao_pagamento_padrao || "—"}
                />

                {cliente.observacoes && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3 mt-3">
                    {cliente.observacoes}
                  </p>
                )}

                <div className="flex gap-2 pt-4">
                  <Button size="sm" variant="outline" disabled>
                    <Edit className="h-4 w-4" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" disabled>
                    <Ban className="h-4 w-4" /> Bloquear
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="pedidos" className="space-y-2 mt-4">
                {pedidos.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Sem pedidos ainda.
                  </div>
                ) : (
                  pedidos.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center border rounded-md p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          #P-{String(p.numero_pedido).padStart(6, "0")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")} · {p.status}
                        </p>
                      </div>
                      <span className="font-medium">{formatBRL(Number(p.total))}</span>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Em aberto</p>
                    <p className="text-lg font-bold">{formatBRL(emAberto)}</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Atrasado</p>
                    <p
                      className={`text-lg font-bold ${
                        atrasado > 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatBRL(atrasado)}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-medium text-muted-foreground pt-2">
                  Próximos vencimentos
                </p>
                {pagamentos.filter((p: any) => p.status === "aberto" || p.status === "atrasado")
                  .length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Sem pendências.
                  </p>
                ) : (
                  pagamentos
                    .filter((p: any) => p.status === "aberto" || p.status === "atrasado")
                    .slice(0, 10)
                    .map((pg: any) => (
                      <div
                        key={pg.id}
                        className="flex justify-between items-center border rounded-md p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            #P-{String(pg.pedido?.numero_pedido).padStart(6, "0")} · parcela{" "}
                            {pg.parcela}/{pg.total_parcelas}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Venc:{" "}
                            {pg.vencimento
                              ? new Date(pg.vencimento).toLocaleDateString("pt-BR")
                              : "—"}{" "}
                            ·{" "}
                            <span
                              className={
                                pg.status === "atrasado" ? "text-destructive font-medium" : ""
                              }
                            >
                              {pg.status}
                            </span>
                          </p>
                        </div>
                        <span className="font-medium">{formatBRL(Number(pg.valor))}</span>
                      </div>
                    ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="border rounded-md p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold mt-1">{valor}</p>
    </div>
  );
}

function Linha({
  icon,
  label,
  valor,
}: {
  icon?: React.ReactNode;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-right truncate max-w-[60%]">{valor}</span>
    </div>
  );
}
