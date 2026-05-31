import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoPedidos() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos B2B</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os pedidos do atacado</p>
        </div>
        <Button asChild size="sm">
          <Link to="/atacado/novo-pedido"><Plus className="h-4 w-4" /> Novo pedido</Link>
        </Button>
      </div>

      <AtacadoEmptyState
        icon={ClipboardList}
        title="Nenhum pedido ainda"
        description="Crie o primeiro pedido B2B para começar a acompanhar."
        ctaLabel="Novo pedido"
        ctaTo="/atacado/novo-pedido"
      />
    </div>
  );
}
