import { useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useEstoque } from "@/hooks/useEstoque";
import { EstoqueDashboard } from "@/components/estoque/EstoqueDashboard";
import { EstoqueList } from "@/components/estoque/EstoqueList";
import { ConferenciaEstoque } from "@/components/estoque/ConferenciaEstoque";
import { EntradasEstoque } from "@/components/estoque/EntradasEstoque";
import { AjusteEstoqueDialog } from "@/components/estoque/AjusteEstoqueDialog";
import { ConferenciaPecasButton } from "@/components/conferencia/ConferenciaPecasButton";
import { HistoricoConferencias } from "@/components/conferencia/HistoricoConferencias";

export default function Pecas() {
  const { itens, categorias, marcas, modelos, conferencias, isLoading, kpis } = useEstoque();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [preSelectedItemId, setPreSelectedItemId] = useState<string | null>(null);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  const handleRegistrarEntrada = (itemId: string) => {
    setPreSelectedItemId(itemId);
    setActiveTab("entradas");
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Estoque de Peças</h1>
          <p className="page-subtitle">
            {kpis.total} peças cadastradas · {kpis.estoqueBaixo > 0 ? `${kpis.estoqueBaixo} com estoque baixo` : "estoque OK"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAjusteOpen(true)}>
            <Wrench className="h-4 w-4 mr-1.5" /> Registrar ajuste
          </Button>
          <ConferenciaPecasButton itens={itens} />
        </div>
      </div>

      <AjusteEstoqueDialog open={ajusteOpen} onOpenChange={setAjusteOpen} itens={itens} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
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
          <TabsTrigger value="historico">Histórico</TabsTrigger>
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

        <TabsContent value="historico">
          <HistoricoConferencias tipo="pecas" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
