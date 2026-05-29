import { useState } from "react";
import { Plus, FileDown, BarChart3, CreditCard, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, maskCPF } from "@/lib/utils";

export default function LojaCrediario() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState<"abertos" | "atrasos" | "quitados" | "cancelados">("abertos");

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["loja-crediario", empresaId, tab],
    queryFn: async () => {
      let q = (supabase as any)
        .from("loja_crediario")
        .select(`*, loja_clientes!inner(nome, cpf)`)
        .eq("empresa_id", empresaId);
      if (tab === "abertos") q = q.eq("status", "aberto");
      if (tab === "quitados") q = q.eq("status", "quitado");
      if (tab === "cancelados") q = q.eq("status", "cancelado");
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && contratos.length === 0;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Crediário</h1>
          <p className="text-sm text-muted-foreground mt-1">Contratos parcelados · cobrança e gestão</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-2" /> Exportar carnê</Button>
          <Button variant="outline" size="sm"><BarChart3 className="h-4 w-4 mr-2" /> Análise SPC</Button>
          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo crediário</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="abertos">Abertos</TabsTrigger>
          <TabsTrigger value="atrasos">Atrasos</TabsTrigger>
          <TabsTrigger value="quitados">Quitados</TabsTrigger>
          <TabsTrigger value="cancelados">Cancelados</TabsTrigger>
        </TabsList>
      </Tabs>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <CreditCard className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum contrato de crediário</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Quando você fechar uma venda no PDV com forma "Crediário", o contrato aparece aqui.
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Contrato</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Parcelas</th>
                  <th className="text-left p-3">Próx. venc.</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c: any) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-semibold">{c.loja_clientes?.nome}</p>
                      <p className="text-xs text-muted-foreground font-mono">{maskCPF(c.loja_clientes?.cpf ?? "")}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">{c.numero_contrato}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{formatBRL(Number(c.total ?? 0))}</td>
                    <td className="p-3 text-right tabular-nums">{c.parcelas}x</td>
                    <td className="p-3">{c.primeiro_vencimento ? new Date(c.primeiro_vencimento).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" /> Ver</Button>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberto: "bg-info/15 text-info border-info/30",
    quitado: "bg-success/15 text-success border-success/30",
    cancelado: "bg-muted text-muted-foreground border-border",
    renegociado: "bg-warning/15 text-warning border-warning/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${map[status] ?? map.cancelado}`}>
      {status}
    </span>
  );
}
