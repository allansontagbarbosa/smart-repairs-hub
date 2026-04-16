import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojistaAuth } from "@/hooks/useLojistaAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(v: number | null | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function LojistaFinanceiro() {
  const { lojistaUser } = useLojistaAuth();
  const lojistaId = lojistaUser?.lojista_id;
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const { data: ordens = [] } = useQuery({
    queryKey: ["lojista-financeiro", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, status, valor, valor_pago, data_entrada, defeito_relatado, aparelhos(marca, modelo)")
        .eq("lojista_id", lojistaId!)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      return data ?? [];
    },
  });

  const prefix = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const ordensMes = useMemo(() => ordens.filter(o => o.data_entrada?.startsWith(prefix)), [ordens, prefix]);

  const totalCobrado = ordensMes.reduce((s, o) => s + (o.valor ?? 0), 0);
  const totalPago = ordensMes.reduce((s, o) => s + (o.valor_pago ?? 0), 0);
  const saldoAberto = totalCobrado - totalPago;

  function getStatusPagamento(o: typeof ordens[number]) {
    const v = o.valor ?? 0;
    const p = o.valor_pago ?? 0;
    if (p >= v && v > 0) return { label: "Pago", color: "text-success bg-success-muted" };
    if (p > 0) return { label: "Parcial", color: "text-warning bg-warning-muted" };
    return { label: "Em aberto", color: "text-destructive bg-destructive/10" };
  }

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Financeiro</h1>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
          <FileText className="h-3.5 w-3.5" />
          Baixar extrato PDF
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {meses.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[now.getFullYear(), now.getFullYear() - 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="OS no período" value={ordensMes.length} />
        <SummaryCard label="Total cobrado" value={fmt(totalCobrado)} />
        <SummaryCard label="Total pago" value={fmt(totalPago)} color="text-success" />
        <SummaryCard label="Saldo em aberto" value={fmt(saldoAberto)} color={saldoAberto > 0 ? "text-destructive" : "text-success"} />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden print:border-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">OS#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Serviço</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Aparelho</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Pagamento</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Data</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordensMes.map((os) => {
                const sp = getStatusPagamento(os);
                return (
                  <tr key={os.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">#{String(os.numero).padStart(3, "0")}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{os.defeito_relatado}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {(os.aparelhos as any)?.marca} {(os.aparelhos as any)?.modelo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", sp.color)}>{sp.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(os.data_entrada).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(os.valor)}</td>
                  </tr>
                );
              })}
              {ordensMes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Sem movimentações no período</td>
                </tr>
              )}
            </tbody>
            {ordensMes.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold text-right">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold">{fmt(totalCobrado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <p className={cn("text-lg font-bold tracking-tight mt-0.5", color)}>{value}</p>
    </div>
  );
}
