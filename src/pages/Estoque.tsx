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
    toast.success("Peça adicionada ao estoque!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-1">{items.length} itens · {lowStock.length} com estoque baixo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Adicionar Peça</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Peça</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4">
              <div><Label>Nome</Label><Input name="name" required placeholder="Ex: Tela iPhone 15" /></div>
              <div><Label>Categoria</Label><Input name="category" required placeholder="Ex: Telas" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quantidade</Label><Input name="qty" type="number" required min={0} /></div>
                <div><Label>Estoque mínimo</Label><Input name="minQty" type="number" required min={0} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Custo (R$)</Label><Input name="cost" required placeholder="0.00" /></div>
                <div><Label>Preço venda (R$)</Label><Input name="sellPrice" required placeholder="0.00" /></div>
              </div>
              <Button type="submit" className="w-full">Adicionar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Estoque baixo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lowStock.map((i) => `${i.name} (${i.qty})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar peça ou categoria..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Peça</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qtd</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Custo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Venda</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{item.category}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-medium ${item.qty <= item.minQty ? "text-destructive" : ""}`}>
                      {item.qty}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{item.cost}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-medium">{item.sellPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
