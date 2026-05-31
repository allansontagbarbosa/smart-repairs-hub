import { Settings } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoConfiguracoes() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações Atacado</h1>
        <p className="text-sm text-muted-foreground">NF-e, condições padrão, política de crédito</p>
      </div>

      <AtacadoEmptyState
        icon={Settings}
        title="Em breve"
        description="Configurações específicas do módulo atacado."
      />
    </div>
  );
}
