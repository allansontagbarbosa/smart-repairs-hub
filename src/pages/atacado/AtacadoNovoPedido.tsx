import { Zap } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoNovoPedido() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Novo Pedido B2B</h1>
        <p className="text-sm text-muted-foreground">Cliente → Itens → Pagamento → Revisão</p>
      </div>

      <AtacadoEmptyState
        icon={Zap}
        title="Wizard em construção"
        description="O fluxo de criação de pedidos será disponibilizado em breve."
      />
    </div>
  );
}
