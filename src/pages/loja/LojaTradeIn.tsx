import { ArrowLeftRight } from "lucide-react";

export default function LojaTradeIn() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trade-in</h1>
        <p className="text-sm text-muted-foreground mt-1">Avaliação de aparelhos usados</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <ArrowLeftRight className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Trade-in</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Checklist guiado de avaliação, valor sugerido com descontos automáticos por condição, formas de pagamento (abater venda, dinheiro, crédito loja). Implementação na próxima fase.
        </p>
      </div>
    </div>
  );
}
