import { ClipboardList } from "lucide-react";

export default function LojaVendas() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico, trocas, devoluções e estornos</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <ClipboardList className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Vendas</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Lista completa de vendas, filtros por período, vendedor e status. Trocas, devoluções, estornos e segunda via de comprovante. Implementação na próxima fase.
        </p>
      </div>
    </div>
  );
}
