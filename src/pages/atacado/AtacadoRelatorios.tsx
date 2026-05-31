import { BarChart2 } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoRelatorios() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios Atacado</h1>
        <p className="text-sm text-muted-foreground">DRE, top clientes, giro de estoque B2B</p>
      </div>

      <AtacadoEmptyState
        icon={BarChart2}
        title="Em breve"
        description="Análises e relatórios completos do módulo atacado."
      />
    </div>
  );
}
