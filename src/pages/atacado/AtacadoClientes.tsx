import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoClientes() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes B2B</h1>
          <p className="text-sm text-muted-foreground">Lojistas, revendedores e parceiros</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4" /> Novo cliente</Button>
      </div>

      <AtacadoEmptyState
        icon={Users}
        title="Nenhum cliente cadastrado"
        description="Cadastre lojistas e revendedores para começar a vender no atacado."
      />
    </div>
  );
}
