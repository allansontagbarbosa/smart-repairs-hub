import { Wallet } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoCobranca() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cobrança Ativa</h1>
        <p className="text-sm text-muted-foreground">Boletos vencidos, follow-up e negociações</p>
      </div>

      <AtacadoEmptyState
        icon={Wallet}
        title="Em breve"
        description="Régua de cobrança e gestão de inadimplência."
      />
    </div>
  );
}
