import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Order = {
  id: string;
  client: string;
  phone: string;
  device: string;
  issue: string;
  status: "aguardando" | "em_reparo" | "pronto" | "entregue" | "cancelado";
  date: string;
  value: string;
};

const initialOrders: Order[] = [
  { id: "001", client: "Maria Silva", phone: "(11) 99999-1111", device: "iPhone 14", issue: "Tela quebrada", status: "em_reparo", date: "07/04/2026", value: "R$ 350" },
  { id: "002", client: "João Santos", phone: "(11) 98888-2222", device: "Samsung S23", issue: "Bateria viciada", status: "pronto", date: "06/04/2026", value: "R$ 180" },
  { id: "003", client: "Ana Costa", phone: "(11) 97777-3333", device: "Motorola G54", issue: "Não liga", status: "aguardando", date: "08/04/2026", value: "A definir" },
  { id: "004", client: "Pedro Lima", phone: "(11) 96666-4444", device: "iPhone 13", issue: "Troca de tela", status: "entregue", date: "03/04/2026", value: "R$ 420" },
  { id: "005", client: "Carla Souza", phone: "(11) 95555-5555", device: "Xiaomi 13", issue: "Conector de carga", status: "em_reparo", date: "08/04/2026", value: "R$ 120" },
];

export default function Assistencia() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = orders.filter((o) => {
    const matchSearch = o.client.toLowerCase().includes(search.toLowerCase()) ||
      o.device.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search);
    const matchStatus = filterStatus === "todos" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newOrder: Order = {
      id: String(orders.length + 1).padStart(3, "0"),
      client: fd.get("client") as string,
      phone: fd.get("phone") as string,
      device: fd.get("device") as string,
      issue: fd.get("issue") as string,
      status: "aguardando",
      date: new Date().toLocaleDateString("pt-BR"),
      value: "A definir",
    };
    setOrders([newOrder, ...orders]);
    setDialogOpen(false);
    toast.success("Ordem de serviço criada!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Assistência Técnica</h1>
          <p className="text-muted-foreground text-sm mt-1">Ordens de serviço</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Ordem</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Ordem de Serviço</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleNew} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Cliente</Label><Input name="client" required placeholder="Nome do cliente" /></div>
                <div><Label>Telefone</Label><Input name="phone" required placeholder="(00) 00000-0000" /></div>
              </div>
              <div><Label>Aparelho</Label><Input name="device" required placeholder="Ex: iPhone 14 Pro" /></div>
              <div><Label>Defeito</Label><Textarea name="issue" required placeholder="Descreva o problema" rows={2} /></div>
              <Button type="submit" className="w-full">Criar Ordem</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, aparelho ou OS..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="em_reparo">Em Reparo</SelectItem>
            <SelectItem value="pronto">Pronto</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">OS</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Aparelho</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Defeito</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">#{order.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.client}</p>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">{order.device}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{order.issue}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 hidden sm:table-cell font-medium">{order.value}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma ordem encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
