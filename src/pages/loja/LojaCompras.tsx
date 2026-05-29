import { useState } from "react";
import { Plus, Upload, ShoppingBag, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

type Tab = "notas" | "adiantamentos";

/**
 * Compras Loja — Notas de entrada de aparelhos novos/seminovos.
 * Agrupa loja_aparelhos por data_entrada + fornecedor_id como "nota fictícia".
 */
export default function LojaCompras() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState<Tab>("notas");

  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ["loja-compras", empresaId, tab],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_aparelhos")
        .select("data_entrada, fornecedor_id, custo, modelo")
        .eq("empresa_id", empresaId)
        .eq("origem", "compra")
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      if (error) throw error;
      const grupos = new Map<string, { data: string; fornecedor_id: string | null; qtd: number; total: number }>();
      (data ?? []).forEach((a: any) => {
        const key = `${a.data_entrada?.slice(0, 10) ?? ""}_${a.fornecedor_id ?? ""}`;
        if (!grupos.has(key)) {
          grupos.set(key, { data: a.data_entrada, fornecedor_id: a.fornecedor_id, qtd: 0, total: 0 });
        }
        const g = grupos.get(key)!;
        g.qtd++;
        g.total += Number(a.custo);
      });
      return Array.from(grupos.values());
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && entradas.length === 0;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Compras Loja</h1>
          <p className="text-sm text-muted-foreground mt-1">Notas de entrada de aparelhos e estoque</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Importar XML NF-e
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova nota
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="notas">Notas de entrada</TabsTrigger>
          <TabsTrigger value="adiantamentos">Adiantamentos</TabsTrigger>
        </TabsList>
      </Tabs>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhuma compra registrada</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Lance manualmente uma nota de entrada ou importe um XML de NF-e — extraímos itens e preenchemos IMEI/preço pra você.
          </p>
          <div className="flex gap-2">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Lançar nota
            </Button>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar XML
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Fornecedor</th>
                  <th className="text-right p-3">Qtd itens</th>
                  <th className="text-right p-3">Total</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">{new Date(e.data).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3 text-muted-foreground">
                      {e.fornecedor_id ?? <span className="italic">Sem fornecedor</span>}
                    </td>
                    <td className="p-3 text-right">{e.qtd}</td>
                    <td className="p-3 text-right font-semibold">{formatBRL(e.total)}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm">
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
