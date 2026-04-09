import { useState } from "react";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Item = {
  id: number;
  name: string;
  category: string;
  qty: number;
  minQty: number;
  cost: string;
  sellPrice: string;
};

const initialItems: Item[] = [
  { id: 1, name: "Tela iPhone 14", category: "Telas", qty: 2, minQty: 3, cost: "R$ 180", sellPrice: "R$ 350" },
  { id: 2, name: "Tela iPhone 13", category: "Telas", qty: 5, minQty: 3, cost: "R$ 150", sellPrice: "R$ 320" },
  { id: 3, name: "Bateria Samsung S23", category: "Baterias", qty: 1, minQty: 2, cost: "R$ 60", sellPrice: "R$ 150" },
  { id: 4, name: "Conector USB-C universal", category: "Conectores", qty: 8, minQty: 5, cost: "R$ 15", sellPrice: "R$ 80" },
  { id: 5, name: "Bateria iPhone 14", category: "Baterias", qty: 3, minQty: 2, cost: "R$ 70", sellPrice: "R$ 160" },
  { id: 6, name: "Película de vidro universal", category: "Acessórios", qty: 25, minQty: 10, cost: "R$ 5", sellPrice: "R$ 30" },
];

export default function Estoque() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = items.filter((i) => i.qty <= i.minQty);

  const handleNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newItem: Item = {
      id: items.length + 1,
      name: fd.get("name") as string,
      category: fd.get("category") as string,
      qty: Number(fd.get("qty")),
      minQty: Number(fd.get("minQty")),
      cost: `R$ ${fd.get("cost")}`,
      sellPrice: `R$ ${fd.get("sellPrice")}`,
    };
    setItems([newItem, ...items]);
    setDialogOpen(false);
    toast.success("Peça adicionada!");
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">{items.length} itens · {lowStock.length} com estoque baixo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Adicionar Peça</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nova Peça</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4 mt-2">
              <div className="space-y-3">
                <div><Label className="text-xs">Nome</Label><Input name="name" required placeholder="Ex: Tela iPhone 15" className="mt-1.5" /></div>
                <div><Label className="text-xs">Categoria</Label><Input name="category" required placeholder="Ex: Telas" className="mt-1.5" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Quantidade</Label><Input name="qty" type="number" required min={0} className="mt-1.5" /></div>
                  <div><Label className="text-xs">Mínimo</Label><Input name="minQty" type="number" required min={0} className="mt-1.5" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Custo (R$)</Label><Input name="cost" required placeholder="0,00" className="mt-1.5" /></div>
                  <div><Label className="text-xs">Venda (R$)</Label><Input name="sellPrice" required placeholder="0,00" className="mt-1.5" /></div>
                </div>
              </div>
              <Button type="submit" className="w-full">Adicionar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/25 bg-warning-muted p-3.5">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm">
            <span className="font-medium">Estoque baixo: </span>
            <span className="text-muted-foreground">{lowStock.map((i) => `${i.name} (${i.qty})`).join(" · ")}</span>
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar peça ou categoria..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Peça</th>
                <th className="hidden sm:table-cell">Categoria</th>
                <th className="text-center">Qtd</th>
                <th className="hidden md:table-cell text-right">Custo</th>
                <th className="text-right">Venda</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{item.category}</p>
                  </td>
                  <td className="hidden sm:table-cell text-sm text-muted-foreground">{item.category}</td>
                  <td className="text-center">
                    <span className={`text-sm font-medium ${item.qty <= item.minQty ? "text-destructive" : ""}`}>
                      {item.qty}
                    </span>
                  </td>
                  <td className="hidden md:table-cell text-right text-sm text-muted-foreground">{item.cost}</td>
                  <td className="text-right text-sm font-medium">{item.sellPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
