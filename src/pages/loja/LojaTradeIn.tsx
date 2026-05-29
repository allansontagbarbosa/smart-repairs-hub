import { useState } from "react";
import { Plus, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, maskIMEI } from "@/lib/utils";

function StatusTradeBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    avaliacao: "bg-info/15 text-info border-info/30",
    aprovado: "bg-success/15 text-success border-success/30",
    rejeitado: "bg-destructive/15 text-destructive border-destructive/30",
    convertido_estoque: "bg-primary/15 text-primary border-primary/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export default function LojaTradeIn() {
  const { empresaId } = useEmpresa();
  const [, setWizardOpen] = useState(false);

  const { data: tradeIns = [], isLoading } = useQuery({
    queryKey: ["loja-trade-in", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_trade_in")
        .select(`*, clientes(nome)`)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && tradeIns.length === 0;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const noMes = tradeIns.filter((t: any) => new Date(t.created_at) >= inicioMes);
  const convertidos = noMes.filter((t: any) => t.status === "convertido_estoque").length;
  const valorMedio = noMes.length
    ? noMes.reduce((s: number, t: any) => s + Number(t.valor_avaliado), 0) / noMes.length
    : 0;
  const taxa = noMes.length ? Math.round((convertidos / noMes.length) * 100) : 0;
  const emConferencia = tradeIns.filter((t: any) => t.status === "avaliacao").length;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trade-in</h1>
          <p className="text-sm text-muted-foreground mt-1">Avaliação de aparelhos usados que o cliente traz</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo trade-in
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">TRADE-INS NO MÊS</p>
          <p className="text-2xl font-bold mt-1">{noMes.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">VALOR MÉDIO</p>
          <p className="text-2xl font-bold mt-1">{formatBRL(valorMedio)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">CONVERSÃO EM VENDA</p>
          <p className="text-2xl font-bold mt-1">{taxa}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">EM CONFERÊNCIA</p>
          <p className="text-2xl font-bold mt-1">{emConferencia}</p>
        </div>
      </div>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <ArrowLeftRight className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum trade-in registrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Avalie um aparelho usado em 4 passos: identificação, condição, checklist técnico e valor. Após aprovado, vai pro estoque como "em conferência".
          </p>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Avaliar primeiro aparelho
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Aparelho</th>
                  <th className="text-left p-3">IMEI</th>
                  <th className="text-left p-3">Condição</th>
                  <th className="text-right p-3">Valor avaliado</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {tradeIns.map((t: any) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      {t.clientes?.nome ?? <span className="text-muted-foreground italic">Sem cliente</span>}
                    </td>
                    <td className="p-3">
                      {t.modelo} {t.capacidade}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{maskIMEI(t.imei_1 ?? "")}</td>
                    <td className="p-3 uppercase text-xs">{t.condicao}</td>
                    <td className="p-3 text-right font-semibold">{formatBRL(t.valor_avaliado)}</td>
                    <td className="p-3">
                      <StatusTradeBadge status={t.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
