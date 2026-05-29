import { Store } from "lucide-react";

export default function LojaAparelhos() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Aparelhos</h1>
        <p className="text-sm text-muted-foreground mt-1">Estoque de aparelhos novos e seminovos</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Store className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Aparelhos</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Cadastro de aparelhos por IMEI com condição (novo/seminovo A/B/C), custo, preço, garantia e fornecedor. Filtros por modelo, status e localização. Implementação na próxima fase.
        </p>
      </div>
    </div>
  );
}
