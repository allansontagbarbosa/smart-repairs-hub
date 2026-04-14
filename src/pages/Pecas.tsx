import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEstoque } from "@/hooks/useEstoque";
import { EstoqueDashboard } from "@/components/estoque/EstoqueDashboard";
import { EstoqueList } from "@/components/estoque/EstoqueList";
import { ConferenciaEstoque } from "@/components/estoque/ConferenciaEstoque";
import { EntradasEstoque } from "@/components/estoque/EntradasEstoque";

export default function Pecas() {
  const { itens, categorias, marcas, modelos, conferencias, isLoading, kpis } = useEstoque();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [preSelectedItemId, setPreSelectedItemId] = useState<string | null>(null);

  const handleRegistrarEntrada = (itemId: string) => {
    setPreSelectedItemId(itemId);
    setActiveTab("entradas");
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Estoque de Peças</h1>
        <p className="page-subtitle">
          {kpis.total} peças cadastradas · {kpis.estoqueBaixo > 0 ? `${kpis.estoqueBaixo} com estoque baixo` : "estoque OK"}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          <TabsTrigger value="itens">
            Peças
            {kpis.estoqueBaixo > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-4 px-1">
                {kpis.estoqueBaixo}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EstoqueDashboard kpis={kpis} itens={itens} onRegistrarEntrada={handleRegistrarEntrada} />
        </TabsContent>

        <TabsContent value="itens">
          <EstoqueList itens={itens} categorias={categorias} marcas={marcas} modelos={modelos} />
        </TabsContent>

        <TabsContent value="entradas">
          <EntradasEstoque
            itens={itens}
            preSelectedItemId={preSelectedItemId}
            onClearPreSelected={() => setPreSelectedItemId(null)}
          />
        </TabsContent>

        <TabsContent value="conferencia">
          <ConferenciaEstoque itens={itens} conferencias={conferencias} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
