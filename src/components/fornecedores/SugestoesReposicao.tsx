import { useMemo } from "react";
import { Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onPedirAgora: (item: { estoque_item_id: string; nome: string; custo: number; fornecedorId?: string }) => void;
}

type ItemBaixo = {
  id: string;
  nome_personalizado: string | null;
  quantidade: number;
  quantidade_minima: number;
  custo_unitario: number | null;
  fornecedor: string | null;
};

type EntradaItem = {
  estoque_item_id: string;
  custo_unitario: number | null;
  entradas_estoque: { fornecedor_id: string | null; fornecedor_nome: string | null } | null;
};

type Sugestao = ItemBaixo & {
  fornecedorSugerido: string | null;
  fornecedorId: string | null;
  ultimoPreco: number;
};

export function SugestoesReposicao({ onPedirAgora }: Props) {
  const { data: itens = [] } = useQuery({
    queryKey: ["estoque_itens_baixo"],
    queryFn: async (): Promise<ItemBaixo[]> => {
      const { data } = await supabase
        .from("estoque_itens")
        .select("id, nome_personalizado, quantidade, quantidade_minima, custo_unitario, fornecedor")
        .is("deleted_at", null)
        .order("quantidade");
      const rows = (data ?? []) as unknown as ItemBaixo[];
      return rows.filter((i) => (i.quantidade_minima ?? 0) > 0 && i.quantidade <= i.quantidade_minima);
    },
  });

  const { data: ultimasEntradas = [] } = useQuery({
    queryKey: ["ultimas_entradas_itens"],
    queryFn: async (): Promise<EntradaItem[]> => {
      const { data } = await supabase
        .from("entradas_estoque_itens")
        .select("estoque_item_id, custo_unitario, entradas_estoque(fornecedor_id, fornecedor_nome)")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as EntradaItem[];
    },
  });

  const suggestions = useMemo<Sugestao[]>(() => {
    return itens.map((item) => {
      const lastEntry = ultimasEntradas.find((e) => e.estoque_item_id === item.id);
      return {
        ...item,
        fornecedorSugerido: lastEntry?.entradas_estoque?.fornecedor_nome || item.fornecedor || null,
        fornecedorId: lastEntry?.entradas_estoque?.fornecedor_id || null,
        ultimoPreco: Number(lastEntry?.custo_unitario || item.custo_unitario || 0),
      };
    });
  }, [itens, ultimasEntradas]);

  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-amber-500" />
          Sugestões de reposição
          <Badge variant="secondary" className="text-[10px]">{suggestions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {suggestions.slice(0, 8).map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{item.nome_personalizado || "Item"}</p>
                <p className="text-xs text-muted-foreground">
                  Estoque: <span className="text-destructive font-medium">{item.quantidade}</span>
                  {item.fornecedorSugerido && ` · Fornecedor: ${item.fornecedorSugerido}`}
                </p>
                {item.ultimoPreco > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Último preço: R$ {item.ultimoPreco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => onPedirAgora({
                  estoque_item_id: item.id,
                  nome: item.nome_personalizado || "Item",
                  custo: item.ultimoPreco,
                  fornecedorId: item.fornecedorId ?? undefined,
                })}
              >
                <ShoppingCart className="h-3 w-3 mr-1" /> Pedir agora
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
