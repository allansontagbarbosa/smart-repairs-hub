import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  fornecedor: any;
  onClose: () => void;
}

export function FornecedorHistoricoSheet({ fornecedor, onClose }: Props) {
  const { data: entradas = [] } = useQuery({
    queryKey: ["entradas_fornecedor", fornecedor?.id],
    enabled: !!fornecedor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("entradas_estoque")
        .select("*, entradas_estoque_itens(*, estoque_itens(nome_personalizado))")
        .eq("fornecedor_id", fornecedor.id)
        .order("data_compra", { ascending: false });
      return data || [];
    },
  });

  const chartData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    entradas.forEach((e: any) => {
      const key = e.data_compra?.slice(0, 7) || "unknown";
      byMonth[key] = (byMonth[key] || 0) + (e.valor_total || 0);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, total]) => ({
        mes: format(parseISO(mes + "-01"), "MMM/yy", { locale: ptBR }),
        total,
      }));
  }, [entradas]);

  const pecasMaisCompradas = useMemo(() => {
    const pecas: Record<string, { nome: string; qtd: number }> = {};
    entradas.forEach((e: any) => {
      (e.entradas_estoque_itens || []).forEach((i: any) => {
        const nome = i.estoque_itens?.nome_personalizado || i.nome_item || "Item";
        if (!pecas[nome]) pecas[nome] = { nome, qtd: 0 };
        pecas[nome].qtd += i.quantidade || 0;
      });
    });
    return Object.values(pecas).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [entradas]);

  const totalGasto = entradas.reduce((acc: number, e: any) => acc + (e.valor_total || 0), 0);

  return (
    <Sheet open={!!fornecedor} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico — {fornecedor?.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold">{entradas.length}</p>
              <p className="text-xs text-muted-foreground">Compras</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold">R$ {totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">Total gasto</p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Gasto mensal</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top items */}
          {pecasMaisCompradas.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Peças mais compradas</h4>
              <div className="space-y-1.5">
                {pecasMaisCompradas.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{p.nome}</span>
                    <Badge variant="secondary" className="text-[10px]">{p.qtd} un.</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entries list */}
          <div>
            <h4 className="text-sm font-medium mb-2">Últimas compras</h4>
            <div className="space-y-2">
              {entradas.slice(0, 10).map((e: any) => (
                <div key={e.id} className="flex justify-between items-center text-sm border-b pb-2">
                  <div>
                    <p className="font-medium">{e.numero_nota ? `NF ${e.numero_nota}` : "Entrada"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.data_compra ? new Date(e.data_compra + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                  <span className="font-medium">
                    R$ {(e.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {entradas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma compra registrada</p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
