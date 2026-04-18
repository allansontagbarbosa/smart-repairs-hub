import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Truck, Star, History, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FornecedorFormDialog } from "@/components/fornecedores/FornecedorFormDialog";
import { FornecedorHistoricoSheet } from "@/components/fornecedores/FornecedorHistoricoSheet";
import { PedidoCompraDialog } from "@/components/fornecedores/PedidoCompraDialog";

export default function Fornecedores() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editFornecedor, setEditFornecedor] = useState<any>(null);
  const [historicoFornecedor, setHistoricoFornecedor] = useState<any>(null);
  const [pedidoOpen, setPedidoOpen] = useState(false);
  const [pedidoFornecedorId, setPedidoFornecedorId] = useState<string | null>(null);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      return data || [];
    },
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["avaliacoes_fornecedor"],
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacoes_fornecedor")
        .select("*");
      return data || [];
    },
  });

  const { data: entradas = [] } = useQuery({
    queryKey: ["entradas_estoque_fornecedores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("entradas_estoque")
        .select("id, fornecedor_id, fornecedor_nome, data_compra, valor_total")
        .order("data_compra", { ascending: false });
      return data || [];
    },
  });

  const fornecedorStats = useMemo(() => {
    const stats: Record<string, { compras: number; total: number; ultima: string | null; media: number }> = {};
    for (const f of fornecedores) {
      const fEntradas = entradas.filter((e: any) => e.fornecedor_id === f.id);
      const fAvals = avaliacoes.filter((a: any) => a.fornecedor_id === f.id);
      const mediaNotas = fAvals.length > 0
        ? fAvals.reduce((acc: number, a: any) => acc + ((a.nota_prazo || 0) + (a.nota_qualidade || 0) + (a.nota_preco || 0)) / 3, 0) / fAvals.length
        : 0;
      stats[f.id] = {
        compras: fEntradas.length,
        total: fEntradas.reduce((acc: number, e: any) => acc + (e.valor_total || 0), 0),
        ultima: fEntradas[0]?.data_compra || null,
        media: Math.round(mediaNotas * 10) / 10,
      };
    }
    return stats;
  }, [fornecedores, entradas, avaliacoes]);

  const filtered = fornecedores.filter((f: any) =>
    f.nome?.toLowerCase().includes(search.toLowerCase()) ||
    f.categoria?.toLowerCase().includes(search.toLowerCase()) ||
    f.cnpj_cpf?.includes(search)
  );

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i < full ? "fill-amber-400 text-amber-400" : half && i === full ? "fill-amber-400/50 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
        {rating > 0 && <span className="text-xs text-muted-foreground ml-1">({rating})</span>}
      </span>
    );
  };

  const handleNewPedido = (fornecedorId?: string) => {
    setPedidoFornecedorId(fornecedorId || null);
    setPedidoOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground">{fornecedores.length} fornecedores cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setEditFornecedor(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      <div>
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f: any) => {
              const s = fornecedorStats[f.id] || { compras: 0, total: 0, ultima: null, media: 0 };
              return (
                <Card key={f.id} className={`transition-all hover:shadow-md ${!f.ativo ? "opacity-60" : ""}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-sm flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-primary shrink-0" />
                          {f.nome}
                        </h3>
                        {f.cnpj_cpf && <p className="text-xs text-muted-foreground mt-0.5">CNPJ: {f.cnpj_cpf}</p>}
                      </div>
                      {!f.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>

                    {(f.responsavel || f.telefone) && (
                      <p className="text-xs text-muted-foreground">
                        {f.responsavel && `Contato: ${f.responsavel}`}
                        {f.responsavel && f.telefone && " — "}
                        {f.telefone}
                      </p>
                    )}

                    <div className="h-px bg-border" />

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Compras: <strong>{s.compras}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Total: <strong>R$ {s.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                      </span>
                    </div>

                    {s.ultima && (
                      <p className="text-xs text-muted-foreground">
                        Última compra: {new Date(s.ultima + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    )}

                    {s.media > 0 && <div>{renderStars(s.media)}</div>}

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setHistoricoFornecedor(f)}>
                        <History className="h-3 w-3 mr-1" /> Histórico
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => handleNewPedido(f.id)}>
                        <ShoppingCart className="h-3 w-3 mr-1" /> Nova compra
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => { setEditFornecedor(f); setFormOpen(true); }}>
                        Editar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhum fornecedor encontrado
              </div>
            )}
          </div>
        </div>
      </div>

      <FornecedorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        fornecedor={editFornecedor}
      />

      <FornecedorHistoricoSheet
        fornecedor={historicoFornecedor}
        onClose={() => setHistoricoFornecedor(null)}
      />

      <PedidoCompraDialog
        open={pedidoOpen}
        onOpenChange={setPedidoOpen}
        fornecedorId={pedidoFornecedorId}
      />
    </div>
  );
}
