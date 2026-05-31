import { Briefcase } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoVendedores() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendedores B2B</h1>
        <p className="text-sm text-muted-foreground">Equipe de atacado com comissões diferenciadas</p>
      </div>

      <AtacadoEmptyState
        icon={Briefcase}
        title="Em breve"
        description="Gerencie a equipe de vendedores B2B e suas comissões."
      />
    </div>
  );
}
