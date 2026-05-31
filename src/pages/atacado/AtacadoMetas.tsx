import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoMetas() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas Atacado</h1>
          <p className="text-sm text-muted-foreground">Faturamento, qtd pedidos, novos clientes</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4" /> Definir meta</Button>
      </div>

      <AtacadoEmptyState
        icon={Target}
        title="Nenhuma meta definida"
        description="Estabeleça metas para acompanhar o desempenho do atacado."
      />
    </div>
  );
}
