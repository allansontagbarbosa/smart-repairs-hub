import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

const STATUS_CFG: Record<string, string> = {
  aberto: "bg-info/15 text-info border-info/30",
  atrasado: "bg-destructive/15 text-destructive border-destructive/30",
  pago: "bg-success/15 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground",
};

export default function AtacadoFinanceiro() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [quitando, setQuitando] = useState<any | null>(null);
  const [formaRecebido, setFormaRecebido] = useState("pix");
  const [obsRecebimento, setObsRecebimento] = useState("");

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["atacado-financeiro-kpis", empresaId],
    queryFn: async () => {
      const { data } = await supabase.rpc("atacado_financeiro_kpis" as any, {
        p_empresa_id: empresaId,
      });
      return (data as any)?.[0];
    },
    enabled: !!empresaId,
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["atacado-pagamentos", empresaId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("atacado_pedidos_pagamentos")
        .select(
          `*, pedido:atacado_pedidos!inner(numero_pedido, empresa_id,
             cliente:atacado_clientes(razao_social, nome_fantasia))`
        )
        .eq("pedido.empresa_id", empresaId!);
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      const { data } = await q.order("vencimento", { ascending: true }).limit(200);
      return (data ?? []) as any[];
    },
    enabled: !!empresaId,
  });

  const quitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("quitar_pagamento_atacado" as any, {
        p_pagamento_id: quitando.id,
        p_forma_recebido: formaRecebido,
        p_observacoes: obsRecebimento || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Recebimento registrado" });
      qc.invalidateQueries({ queryKey: ["atacado-pagamentos"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
      setQuitando(null);
      setObsRecebimento("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Financeiro Atacado</h1>
        <p className="text-sm text-muted-foreground">
          Fluxo de caixa B2B, recebimentos e inadimplência
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={<DollarSign className="h-3 w-3" />}
          label="A receber"
          valor={formatBRL(Number(kpis?.total_aberto ?? 0))}
          sub={`${kpis?.qtd_boletos_aberto ?? 0} boleto(s)`}
          loading={kpisLoading}
        />
        <Kpi
          icon={<TrendingUp className="h-3 w-3" />}
          label="Recebido no mês"
          valor={formatBRL(Number(kpis?.total_pago_mes ?? 0))}
          success
          loading={kpisLoading}
        />
        <Kpi
          icon={<AlertTriangle className="h-3 w-3" />}
          label="Atrasado"
          valor={formatBRL(Number(kpis?.total_atrasado ?? 0))}
          sub={`${kpis?.qtd_boletos_atrasado ?? 0} boleto(s)`}
          danger
          loading={kpisLoading}
        />
        <Kpi
          icon={<Wallet className="h-3 w-3" />}
          label="Clientes inadimplentes"
          valor={String(kpis?.qtd_clientes_atrasados ?? 0)}
          loading={kpisLoading}
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <h2 className="text-lg font-semibold">Pagamentos pendentes</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="aberto">Em aberto</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pagamentos.length === 0 ? (
        <AtacadoEmptyState
          icon={DollarSign}
          title="Sem pagamentos"
          description="Nenhum pagamento encontrado com este filtro."
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Pedido / Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Forma</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Parcela</th>
                <th className="text-left p-3 font-medium">Vencimento</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((pg: any) => {
                const cliente =
                  pg.pedido?.cliente?.nome_fantasia ||
                  pg.pedido?.cliente?.razao_social ||
                  "—";
                const venc = pg.vencimento ? new Date(pg.vencimento) : null;
                const diasAtraso = venc
                  ? Math.floor((Date.now() - venc.getTime()) / 86400000)
                  : 0;
                return (
                  <tr key={pg.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-mono text-xs">
                        #P-{String(pg.pedido?.numero_pedido).padStart(6, "0")}
                      </div>
                      <div className="text-sm">{cliente}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell">{pg.forma}</td>
                    <td className="p-3 hidden lg:table-cell tabular-nums">
                      {pg.parcela}/{pg.total_parcelas}
                    </td>
                    <td className="p-3 text-sm">
                      {venc ? venc.toLocaleDateString("pt-BR") : "—"}
                      {pg.status === "atrasado" && diasAtraso > 0 && (
                        <div className="text-[10px] text-destructive font-semibold">
                          +{diasAtraso}d atraso
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">
                      {formatBRL(Number(pg.valor))}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_CFG[pg.status] ?? ""}>
                        {pg.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {(pg.status === "aberto" || pg.status === "atrasado") && (
                        <Button size="sm" variant="outline" onClick={() => setQuitando(pg)}>
                          <CheckCircle2 className="h-3 w-3" /> Quitar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!quitando} onOpenChange={(v) => !v && setQuitando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
          </DialogHeader>
          {quitando && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Pedido</div>
                <div className="font-mono font-semibold">
                  #P-{String(quitando.pedido?.numero_pedido).padStart(6, "0")}
                </div>
                <div className="text-sm mt-1">
                  Parcela {quitando.parcela}/{quitando.total_parcelas} ·{" "}
                  <strong>{formatBRL(Number(quitando.valor))}</strong>
                </div>
              </div>

              <div>
                <Label>Forma recebida</Label>
                <Select value={formaRecebido} onValueChange={setFormaRecebido}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={obsRecebimento}
                  onChange={(e) => setObsRecebimento(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuitando(null)}>
              Cancelar
            </Button>
            <Button onClick={() => quitar.mutate()} disabled={quitar.isPending}>
              {quitar.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon, label, valor, sub, loading, success, danger }: any) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        {icon} {label}
      </div>
      <div
        className={`text-xl font-bold tabular-nums ${
          danger ? "text-destructive" : success ? "text-success" : "text-foreground"
        }`}
      >
        {loading ? <span className="text-muted-foreground">—</span> : valor}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
