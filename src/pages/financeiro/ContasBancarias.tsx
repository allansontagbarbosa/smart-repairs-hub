import { useMemo, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContaBancaria, TIPO_CONTA_LABEL, useContasBancarias,
} from "@/hooks/useContasBancarias";
import { NovaContaBancariaDialog } from "@/components/financeiro/contas/NovaContaBancariaDialog";
import { ContaExtratoSheet } from "@/components/financeiro/contas/ContaExtratoSheet";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ContasBancarias() {
  const { data: contas = [], isLoading } = useContasBancarias();
  const [novaOpen, setNovaOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<ContaBancaria | null>(null);

  const consolidado = useMemo(
    () => contas.filter((c) => c.ativa).reduce((s, c) => s + c.saldo, 0),
    [contas]
  );

  // refresh in-sheet account data when list updates
  const contaAtualizada = useMemo(
    () => (selecionada ? contas.find((c) => c.id === selecionada.id) ?? selecionada : null),
    [contas, selecionada]
  );

  const saldoColor = (n: number) => (n < 0 ? "text-destructive" : "text-[#00C896]");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Contas bancárias</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie suas contas, saldos e movimentações.
            </p>
          </div>
          <Button onClick={() => setNovaOpen(true)} className="bg-[#00C896] hover:bg-[#00C896]/90 text-white">
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </header>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Wallet className="h-4 w-4 text-[#00C896]" />
            Saldo consolidado
          </div>
          <div className={`mt-2 text-3xl sm:text-4xl font-semibold tracking-tight ${saldoColor(consolidado)}`}>
            R$ {fmt(consolidado)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Soma de {contas.filter((c) => c.ativa).length} {contas.filter((c) => c.ativa).length === 1 ? "conta ativa" : "contas ativas"}
          </div>
        </section>

        <section>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-10 text-center">Carregando contas...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {contas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelecionada(c)}
                  className="text-left rounded-2xl border bg-card hover:bg-card/80 transition p-4 focus:outline-none focus:ring-2 focus:ring-[#00C896]/40"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.cor || "#00C896" }}
                    />
                    <div className="text-sm font-medium truncate flex-1">{c.nome}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {TIPO_CONTA_LABEL[c.tipo] || c.tipo}
                    {c.instituicao ? ` · ${c.instituicao}` : ""}
                  </div>
                  <div className={`mt-3 text-xl font-semibold ${saldoColor(c.saldo)}`}>
                    R$ {fmt(c.saldo)}
                  </div>
                </button>
              ))}

              <button
                onClick={() => setNovaOpen(true)}
                className="rounded-2xl border-2 border-dashed border-border/70 hover:border-[#00C896]/70 hover:text-[#00C896] transition p-4 min-h-[120px] flex flex-col items-center justify-center text-muted-foreground"
              >
                <Plus className="h-5 w-5 mb-1" />
                <span className="text-sm font-medium">Nova conta</span>
              </button>
            </div>
          )}
        </section>
      </div>

      <NovaContaBancariaDialog open={novaOpen} onOpenChange={setNovaOpen} />
      <ContaExtratoSheet
        conta={contaAtualizada}
        onOpenChange={(v) => { if (!v) setSelecionada(null); }}
      />
    </div>
  );
}
