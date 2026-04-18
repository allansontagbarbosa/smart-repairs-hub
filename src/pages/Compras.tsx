import { ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEstoque } from "@/hooks/useEstoque";
import { EntradasEstoque } from "@/components/estoque/EntradasEstoque";
import { PedidosCompraList } from "@/components/fornecedores/PedidosCompraList";
import { PedidoCompraDialog } from "@/components/fornecedores/PedidoCompraDialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function Compras() {
  const { itens, isLoading } = useEstoque();
  const [pedidoOpen, setPedidoOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" /> Compras
        </h1>
        <p className="page-subtitle">
          Gerencie pedidos enviados a fornecedores e registre as compras recebidas no estoque.
        </p>
      </div>

      <Tabs defaultValue="recebidas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pedidos">Pedidos de compra</TabsTrigger>
          <TabsTrigger value="recebidas">Compras recebidas</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <PedidosCompraList onNewPedido={() => setPedidoOpen(true)} />
        </TabsContent>

        <TabsContent value="recebidas">
          <EntradasEstoque itens={itens} />
        </TabsContent>
      </Tabs>

      <PedidoCompraDialog open={pedidoOpen} onOpenChange={setPedidoOpen} fornecedorId={null} />
    </div>
  );
}
