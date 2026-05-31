import { Smartphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoAparelhos() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estoque Atacado</h1>
          <p className="text-sm text-muted-foreground">Aparelhos disponíveis para venda B2B (por lote)</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4" /> Nova entrada</Button>
      </div>

      <AtacadoEmptyState
        icon={Smartphone}
        title="Estoque vazio"
        description="Registre lotes de aparelhos para disponibilizar no catálogo B2B."
      />
    </div>
  );
}
