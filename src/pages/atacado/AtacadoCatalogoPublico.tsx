import { Store } from "lucide-react";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoCatalogoPublico() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catálogo Público B2B</h1>
        <p className="text-sm text-muted-foreground">Área onde lojistas logam e fazem pedidos sozinhos</p>
      </div>

      <AtacadoEmptyState
        icon={Store}
        title="Em breve"
        description="Configure o catálogo público acessado pelos seus lojistas."
      />
    </div>
  );
}
