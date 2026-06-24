import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  MessageSquare,
  Phone,
  Mail,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoCobranca() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [faixa, setFaixa] = useState("todos");
  const [baixaOpen, setBaixaOpen] = useState<any>(null);

  const { data: vencidos = [], isLoading } = useQuery({
    queryKey: ["atacado-cobranca", empresaId, faixa],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_pedidos_pagamentos")
        .select(
          `*, pedido:atacado_pedidos!inner(numero_pedido, empresa_id, cliente:atacado_clientes(*))`
        )
        .in("status", ["aberto", "atrasado", "parcial"])
        .lt("vencimento", new Date().toISOString().slice(0, 10))
        .order("vencimento");

      const hoje = new Date();
      return (data ?? [])
        .filter((p: any) => p.pedido?.empresa_id === empresaId)
        .map((p: any) => {
          const diasAtraso = Math.floor(
            (hoje.getTime() - new Date(p.vencimento).getTime()) / 86400000
          );
          return { ...p, diasAtraso };
        })
        .filter((p: any) => {
          if (faixa === "todos") return true;
          if (faixa === "1-7") return p.diasAtraso <= 7;
          if (faixa === "8-30")
            return p.diasAtraso >= 8 && p.diasAtraso <= 30;
          if (faixa === "30+") return p.diasAtraso > 30;
          return true;
        });
    },
    enabled: !!empresaId,
  });

  const baixar = useMutation({
    mutationFn: async ({ pagamentoId, forma, data }: any) => {
      const { error } = await supabase.rpc("atacado_baixar_pagamento", {
        p_pagamento_id: pagamentoId,
        p_forma_recebido: forma,
        p_data_recebimento: data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-cobranca"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
      qc.invalidateQueries({ queryKey: ["atacado-top-devedores"] });
      toast({ title: "✓ Pagamento baixado" });
      setBaixaOpen(null);
    },
    onError: (e: any) =>
      toast({
        title: "Erro",
        description: e.message,
        variant: "destructive",
      }),
  });

  const totalDevido = vencidos.reduce(
    (s: number, p: any) => s + (Number(p.valor) - Number(p.valor_pago ?? 0)),
    0
  );
  const clientesUnicos = new Set(
    vencidos.map((p: any) => p.pedido?.cliente?.id)
  ).size;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cobrança Ativa</h1>
        <p className="text-sm text-muted-foreground">
          Boletos vencidos, follow-up e baixas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Total a cobrar
          </div>
          <div className="text-xl font-semibold mt-1 text-destructive">
            {formatBRL(totalDevido)}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Títulos vencidos
          </div>
          <div className="text-xl font-semibold mt-1">{vencidos.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Clientes inadimplentes
          </div>
          <div className="text-xl font-semibold mt-1">{clientesUnicos}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Select value={faixa} onValueChange={setFaixa}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas faixas</SelectItem>
            <SelectItem value="1-7">1-7 dias atraso</SelectItem>
            <SelectItem value="8-30">8-30 dias</SelectItem>
            <SelectItem value="30+">30+ dias (críticos)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vencidos.length === 0 ? (
        <AtacadoEmptyState
          icon={CheckCircle2}
          title="Nenhum título vencido"
          description="Todos os pagamentos estão em dia. 🎉"
        />
      ) : (
        <div className="space-y-3">
          {vencidos.map((p: any) => {
            const cliente = p.pedido?.cliente;
            const cls =
              p.diasAtraso > 60
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : p.diasAtraso > 30
                ? "bg-warning/15 text-warning border-warning/30"
                : "bg-info/15 text-info border-info/30";
            const fones = cliente?.telefone?.replace(/\D/g, "") ?? "";
            const numWa = fones.length > 0 ? `55${fones}` : "";
            const msgWa = encodeURIComponent(
              `Olá ${cliente?.nome_fantasia || cliente?.razao_social || ""}, identificamos um título em aberto no valor de ${formatBRL(
                Number(p.valor)
              )} vencido em ${new Date(p.vencimento).toLocaleDateString(
                "pt-BR"
              )} (Pedido #P-${String(p.pedido?.numero_pedido).padStart(
                6,
                "0"
              )}). Podemos regularizar?`
            );

            return (
              <div key={p.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">
                        {cliente?.nome_fantasia || cliente?.razao_social}
                      </div>
                      <Badge variant="outline" className={cls}>
                        {p.diasAtraso}d atraso
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cliente?.cnpj ? maskCNPJ(cliente.cnpj) : "—"} · Pedido
                      #P-{String(p.pedido?.numero_pedido).padStart(6, "0")} ·
                      Parcela {p.parcela}/{p.total_parcelas} · {p.forma}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vencimento:{" "}
                      {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatBRL(Number(p.valor) - Number(p.valor_pago ?? 0))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setBaixaOpen(p)}>
                    <Wallet className="h-4 w-4 mr-2" /> Marcar pago
                  </Button>
                  {numWa && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`https://wa.me/${numWa}?text=${msgWa}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  {cliente?.telefone && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`tel:${fones}`}>
                        <Phone className="h-4 w-4 mr-2" /> Ligar
                      </a>
                    </Button>
                  )}
                  {cliente?.email && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`mailto:${cliente.email}`}>
                        <Mail className="h-4 w-4 mr-2" /> E-mail
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {baixaOpen && (
        <BaixaDialog
          pagamento={baixaOpen}
          onClose={() => setBaixaOpen(null)}
          onConfirm={baixar.mutate}
          isPending={baixar.isPending}
        />
      )}
    </div>
  );
}

function BaixaDialog({ pagamento, onClose, onConfirm, isPending }: any) {
  const [forma, setForma] = useState<string>(pagamento.forma);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30">
            <div className="text-lg font-semibold">
              {formatBRL(Number(pagamento.valor))}
            </div>
            <div className="text-xs text-muted-foreground">
              Parcela {pagamento.parcela}/{pagamento.total_parcelas}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Forma de recebimento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data do recebimento</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onConfirm({ pagamentoId: pagamento.id, forma, data })
            }
            disabled={isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
