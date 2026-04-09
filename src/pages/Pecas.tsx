import { useState } from "react";
import { Plus, Search, Loader2, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAlertasPecas } from "@/hooks/useAlertasPecas";
import { AlertsBanner } from "@/components/AlertsBanner";

const categorias = ["Todos", "Telas", "Baterias", "Conectores", "Câmeras", "Outros"];

async function fetchPecas() {
  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data;
}

const fmt = (v: number | null) => {
  if (!v && v !== 0) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

export default function Pecas() {
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("Todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const { data: pecas = [], isLoading } = useQuery({
    queryKey: ["pecas"],
    queryFn: fetchPecas,
  });

  const createMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const { error } = await supabase.from("estoque").insert({
        nome: fd.get("nome") as string,
        categoria: (fd.get("categoria") as string) || null,
        quantidade: Number(fd.get("quantidade")) || 0,
        quantidade_minima: Number(fd.get("quantidade_minima")) || 0,
        preco_custo: Number(fd.get("preco_custo")) || 0,
        preco_venda: Number(fd.get("preco_venda")) || 0,
        fornecedor: (fd.get("fornecedor") as string) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pecas"] });
      setDialogOpen(false);
      toast.success("Peça adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("estoque").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pecas"] });
      setEditItem(null);
      toast.success("Peça atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = pecas.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.nome.toLowerCase().includes(q) || (p.categoria ?? "").toLowerCase().includes(q) || (p.fornecedor ?? "").toLowerCase().includes(q);
    const matchCat = filterCategoria === "Todos" || p.categoria === filterCategoria;
    return matchSearch && matchCat;
  });

  const lowStock = pecas.filter((p) => p.quantidade <= p.quantidade_minima && p.quantidade_minima > 0);
  const alertasPecas = useAlertasPecas(pecas);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Peças e Insumos</h1>
          <p className="page-subtitle">
            {pecas.length} itens · {lowStock.length > 0 ? `${lowStock.length} com estoque baixo` : "estoque OK"}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Nova Peça
        </Button>
      </div>

      {/* Low stock alerts */}
      <AlertsBanner alertas={alertasPecas} max={6} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar peça, tipo ou fornecedor..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Peça</th>
                  <th className="hidden sm:table-cell">Tipo</th>
                  <th className="text-center">Qtd</th>
                  <th className="hidden md:table-cell text-right">Custo</th>
                  <th className="text-right hidden sm:table-cell">Venda</th>
                  <th className="hidden lg:table-cell">Fornecedor</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium text-sm">{item.nome}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{item.categoria ?? "—"}</p>
                    </td>
                    <td className="hidden sm:table-cell text-sm text-muted-foreground">{item.categoria ?? "—"}</td>
                    <td className="text-center">
                      <span className={cn("text-sm font-medium", item.quantidade <= item.quantidade_minima && "text-destructive")}>
                        {item.quantidade}
                      </span>
                      <span className="text-xs text-muted-foreground">/{item.quantidade_minima}</span>
                    </td>
                    <td className="hidden md:table-cell text-right text-sm text-muted-foreground">{fmt(item.preco_custo)}</td>
                    <td className="text-right hidden sm:table-cell text-sm font-medium">{fmt(item.preco_venda)}</td>
                    <td className="hidden lg:table-cell text-sm text-muted-foreground">{item.fornecedor ?? "—"}</td>
                    <td>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">Nenhuma peça encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Peça</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-4 mt-2">
            <div><Label className="text-xs">Nome da peça *</Label><Input name="nome" required placeholder="Ex: Tela iPhone 14" className="mt-1.5" /></div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select name="categoria" defaultValue="Telas">
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.filter(c => c !== "Todos").map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Quantidade</Label><Input name="quantidade" type="number" min={0} defaultValue={0} className="mt-1.5" /></div>
              <div><Label className="text-xs">Mínimo</Label><Input name="quantidade_minima" type="number" min={0} defaultValue={0} className="mt-1.5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Custo (R$)</Label><Input name="preco_custo" type="number" min={0} step="0.01" placeholder="0,00" className="mt-1.5" /></div>
              <div><Label className="text-xs">Venda (R$)</Label><Input name="preco_venda" type="number" min={0} step="0.01" placeholder="0,00" className="mt-1.5" /></div>
            </div>
            <div><Label className="text-xs">Fornecedor</Label><Input name="fornecedor" placeholder="Opcional" className="mt-1.5" /></div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Adicionar Peça
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Peça</SheetTitle></SheetHeader>
          {editItem && (
            <form
              className="space-y-4 mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: editItem.id,
                  data: {
                    nome: fd.get("nome") as string,
                    categoria: (fd.get("categoria") as string) || null,
                    quantidade: Number(fd.get("quantidade")) || 0,
                    quantidade_minima: Number(fd.get("quantidade_minima")) || 0,
                    preco_custo: Number(fd.get("preco_custo")) || 0,
                    preco_venda: Number(fd.get("preco_venda")) || 0,
                    fornecedor: (fd.get("fornecedor") as string) || null,
                  },
                });
              }}
            >
              <div><Label className="text-xs">Nome *</Label><Input name="nome" required defaultValue={editItem.nome} className="mt-1.5" /></div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select name="categoria" defaultValue={editItem.categoria ?? "Outros"}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categorias.filter(c => c !== "Todos").map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Quantidade</Label><Input name="quantidade" type="number" min={0} defaultValue={editItem.quantidade} className="mt-1.5" /></div>
                <div><Label className="text-xs">Mínimo</Label><Input name="quantidade_minima" type="number" min={0} defaultValue={editItem.quantidade_minima} className="mt-1.5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Custo (R$)</Label><Input name="preco_custo" type="number" min={0} step="0.01" defaultValue={editItem.preco_custo ?? 0} className="mt-1.5" /></div>
                <div><Label className="text-xs">Venda (R$)</Label><Input name="preco_venda" type="number" min={0} step="0.01" defaultValue={editItem.preco_venda ?? 0} className="mt-1.5" /></div>
              </div>
              <div><Label className="text-xs">Fornecedor</Label><Input name="fornecedor" defaultValue={editItem.fornecedor ?? ""} className="mt-1.5" /></div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Salvar
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
