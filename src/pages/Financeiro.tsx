import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { FinanceiroDashboard } from "@/components/financeiro/FinanceiroDashboard";
import { ContasPagar } from "@/components/financeiro/ContasPagar";
import { Comissoes } from "@/components/financeiro/Comissoes";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";

export default function Financeiro() {
  const { contas, comissoes, categorias, centros, funcionarios, isLoading, kpis } = useFinanceiro();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Financeiro</h1>
        <p className="page-subtitle">Contas, comissões e visão de lucro</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          <TabsTrigger value="contas">
            Contas
            {kpis.contasVencidas > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-4 px-1">
                {kpis.contasVencidas}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="comissoes">
            Comissões
            {kpis.comissoesPendentesCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold h-4 min-w-4 px-1">
                {kpis.comissoesPendentesCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FinanceiroDashboard kpis={kpis} />
        </TabsContent>

        <TabsContent value="contas">
          <ContasPagar contas={contas} categorias={categorias} centros={centros} />
        </TabsContent>

        <TabsContent value="comissoes">
          <Comissoes comissoes={comissoes} funcionarios={funcionarios} onViewOrder={setSelectedOrderId} />
        </TabsContent>
      </Tabs>

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
