import { DollarSign } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoFinanceiro() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro Atacado</h1>
        <p className="text-sm text-muted-foreground">Fluxo de caixa B2B, contas a receber, inadimplência</p>
      </div>

      <AtacadoEmptyState
        icon={DollarSign}
        title="Em breve"
        description="Acompanhamento financeiro dedicado ao módulo atacado."
      />
    </div>
  );
}
