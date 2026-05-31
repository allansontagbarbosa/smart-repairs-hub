import { ReceiptText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoTabelasPreco() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tabelas de Preço</h1>
          <p className="text-sm text-muted-foreground">Tabela A, B, C... com markups e descontos por quantidade</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4" /> Nova tabela</Button>
      </div>

      <AtacadoEmptyState
        icon={ReceiptText}
        title="Nenhuma tabela definida"
        description="Crie tabelas escalonadas para diferentes perfis de clientes."
      />
    </div>
  );
}
