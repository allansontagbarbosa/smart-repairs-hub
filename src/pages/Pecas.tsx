import { useState } from "react";
import { Loader2, Wrench, ShoppingCart, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useEstoque } from "@/hooks/useEstoque";
import { EstoqueDashboard } from "@/components/estoque/EstoqueDashboard";
import { EstoqueList } from "@/components/estoque/EstoqueList";
import { ConferenciaEstoque } from "@/components/estoque/ConferenciaEstoque";
import { AjusteEstoqueDialog } from "@/components/estoque/AjusteEstoqueDialog";
import { ConferenciaPecasButton } from "@/components/conferencia/ConferenciaPecasButton";
import { HistoricoConferencias } from "@/components/conferencia/HistoricoConferencias";

export default function Pecas() {
  const { itens, categorias, marcas, modelos, conferencias, isLoading, kpis } = useEstoque();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ajusteOpen, setAjusteOpen] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Estoque de Peças</h1>
          <p className="page-subtitle">
            {kpis.total} peças cadastradas · {kpis.estoqueBaixo > 0 ? `${kpis.estoqueBaixo} com estoque baixo` : "estoque OK"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to="/compras">
              <ShoppingCart className="h-4 w-4 mr-1.5" /> Nova compra
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAjusteOpen(true)}>
            <Wrench className="h-4 w-4 mr-1.5" /> Registrar ajuste
          </Button>
          <ConferenciaPecasButton itens={itens} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <SettingsIcon className="h-3.5 w-3.5 shrink-0" />
        <span>
          Esta tela mostra o <strong>saldo</strong> de cada peça. Para cadastrar nova peça (SKU, categoria, custo de referência), acesse{" "}
          <Link to="/configuracoes/pecas" className="text-primary hover:underline font-medium">Configurações &gt; Peças</Link>.
        </span>
      </div>

      <AjusteEstoqueDialog open={ajusteOpen} onOpenChange={setAjusteOpen} itens={itens} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          <TabsTrigger value="itens">
            Peças
            {kpis.estoqueBaixo > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-4 px-1">
                {kpis.estoqueBaixo}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EstoqueDashboard kpis={kpis} itens={itens} onRegistrarEntrada={() => {}} />
        </TabsContent>

        <TabsContent value="itens">
          <EstoqueList itens={itens} categorias={categorias} marcas={marcas} modelos={modelos} />
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
