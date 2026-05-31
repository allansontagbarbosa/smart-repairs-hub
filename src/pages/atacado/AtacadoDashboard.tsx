import { Building2, BarChart2 } from "lucide-react";
import { ComboWidget } from "@/components/ComboWidget";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Dashboard Atacado
        </h1>
        <p className="text-sm text-muted-foreground">Visão geral do módulo B2B/distribuidora</p>
      </div>

      <ComboWidget compact />

      <AtacadoEmptyState
        icon={BarChart2}
        title="KPIs em breve"
        description="Faturamento, pedidos, ticket médio e top clientes serão exibidos aqui."
      />
    </div>
  );
}
