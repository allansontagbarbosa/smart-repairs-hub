import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEstoque } from "@/hooks/useEstoque";
import { EstoqueDashboard } from "@/components/estoque/EstoqueDashboard";
import { EstoqueList } from "@/components/estoque/EstoqueList";
import { ConferenciaEstoque } from "@/components/estoque/ConferenciaEstoque";

export default function Pecas() {
  const { itens, categorias, marcas, modelos, conferencias, isLoading, kpis } = useEstoque();

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Estoque</h1>
        <p className="page-subtitle">
          {kpis.total} itens · {kpis.estoqueBaixo > 0 ? `${kpis.estoqueBaixo} com estoque baixo` : "estoque OK"}
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          <TabsTrigger value="itens">
            Itens
            {kpis.estoqueBaixo > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-4 px-1">
                {kpis.estoqueBaixo}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EstoqueDashboard kpis={kpis} />
        </TabsContent>

        <TabsContent value="itens">
          <EstoqueList itens={itens} categorias={categorias} marcas={marcas} modelos={modelos} />
        </TabsContent>

        <TabsContent value="conferencia">
          <ConferenciaEstoque itens={itens} conferencias={conferencias} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
